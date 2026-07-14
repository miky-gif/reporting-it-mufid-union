// Statistiques avancées de la plateforme (écran « Statistiques » de l'admin).
// Toutes les durées sont agrégées en MINUTES (exact), les heures en sont dérivées.
import { Op } from "sequelize";
import { Activite, PRIORITES, STATUTS, User } from "../models/index.js";
import {
  estEnRetard,
  libelleCategorie,
  libellePriorite,
  libelleStatut,
  pointsDepuisMinutes,
  referenceActivite,
} from "../utils.js";
import { chargerMapCategories } from "./categoriesStore.js";

const MOIS_COURT = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const minutesOf = (a) => a.duree_minutes || Math.round((a.duree_heures || 0) * 60);
const pointsOf = (a) => pointsDepuisMinutes(minutesOf(a));
const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const arr2 = (n) => Math.round(n * 100) / 100;
const fmtJJMMAAAA = (iso) => String(iso).split("-").reverse().join("/");
const fmtCourt = (iso) => {
  const [a, m, j] = String(iso).split("-");
  return `${Number(j)} ${MOIS_COURT[Number(m) - 1]} ${a}`;
};

// Nombre de jours entre l'échéance et aujourd'hui (positif = en retard).
function joursRetard(echeance) {
  const auj = new Date(new Date().toISOString().slice(0, 10));
  const ech = new Date(String(echeance));
  return Math.max(0, Math.round((auj - ech) / 86400000));
}

function repartition(cle, activites, libelleFn, mapCat) {
  const compte = new Map();
  for (const a of activites) {
    const k = a[cle];
    if (!compte.has(k)) compte.set(k, { nb: 0, minutes: 0, points: 0 });
    const e = compte.get(k);
    e.nb += 1;
    e.minutes += minutesOf(a);
    if (a.statut === "CLOTURE") e.points += pointsOf(a);
  }
  const total = activites.length;
  return [...compte.entries()]
    .map(([k, e]) => ({
      cle: k,
      libelle: cle === "categorie" ? mapCat[k]?.nom ?? libelleCategorie(k) : libelleFn(k),
      couleur: cle === "categorie" ? mapCat[k]?.couleur ?? "#8A99A1" : undefined,
      total: e.nb,
      minutes: e.minutes,
      heures: arr2(e.minutes / 60),
      points: arr2(e.points),
      pourcentage: pct(e.nb, total),
    }))
    .sort((x, y) => y.total - x.total);
}

export async function statistiquesAvancees(debut, fin) {
  const activites = await Activite.findAll({
    where: { date_activite: { [Op.gte]: debut, [Op.lte]: fin } },
    include: { model: User, as: "user" },
  });
  const users = await User.findAll({ raw: true });
  const mapCat = await chargerMapCategories();

  const total = activites.length;
  const par = (s) => activites.filter((a) => a.statut === s).length;
  const clotures = activites.filter((a) => a.statut === "CLOTURE");
  const enRetard = activites.filter((a) => estEnRetard(a.date_activite, a.statut));

  const minutesTotal = activites.reduce((s, a) => s + minutesOf(a), 0);
  const minutesRealisees = clotures.reduce((s, a) => s + minutesOf(a), 0);
  const pointsTotal = clotures.reduce((s, a) => s + pointsOf(a), 0);

  // --- Performance par agent -------------------------------------------
  const parAgent = new Map();
  for (const a of activites) {
    if (!parAgent.has(a.user_id)) {
      parAgent.set(a.user_id, { nb: 0, clot: 0, retard: 0, minutes: 0, minutesReal: 0, points: 0 });
    }
    const e = parAgent.get(a.user_id);
    e.nb += 1;
    e.minutes += minutesOf(a);
    if (a.statut === "CLOTURE") {
      e.clot += 1;
      e.minutesReal += minutesOf(a);
      e.points += pointsOf(a);
    }
    if (estEnRetard(a.date_activite, a.statut)) e.retard += 1;
  }
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const agents = [...parAgent.entries()]
    .filter(([uid]) => usersById[uid]?.role === "EMPLOYE")
    .map(([uid, e]) => ({
      user_id: uid,
      nom_complet: usersById[uid]?.nom_complet || `Utilisateur #${uid}`,
      poste: usersById[uid]?.poste || "",
      total: e.nb,
      cloturees: e.clot,
      en_retard: e.retard,
      minutes: e.minutes,
      heures: arr2(e.minutes / 60),
      minutes_realisees: e.minutesReal,
      points: arr2(e.points),
      taux_cloture: pct(e.clot, e.nb),
    }))
    .sort((a, b) => b.points - a.points || b.cloturees - a.cloturees);

  // --- Activités en retard (détail) -------------------------------------
  const detailRetard = enRetard
    .map((a) => ({
      id: a.id,
      reference: referenceActivite(a.id),
      titre: a.titre,
      agent: a.user ? a.user.nom_complet : "—",
      categorie: mapCat[a.categorie]?.nom ?? libelleCategorie(a.categorie),
      priorite: libellePriorite(a.priorite),
      statut: libelleStatut(a.statut),
      echeance: fmtJJMMAAAA(a.date_activite),
      jours_retard: joursRetard(a.date_activite),
      pourcentage: a.pourcentage ?? 0,
    }))
    .sort((a, b) => b.jours_retard - a.jours_retard);

  // --- Évolution mensuelle (sur la période) ------------------------------
  const parMois = new Map();
  for (const a of activites) {
    const cle = String(a.date_activite).slice(0, 7);
    if (!parMois.has(cle)) parMois.set(cle, { total: 0, clot: 0, retard: 0 });
    const e = parMois.get(cle);
    e.total += 1;
    if (a.statut === "CLOTURE") e.clot += 1;
    if (estEnRetard(a.date_activite, a.statut)) e.retard += 1;
  }
  const evolution = [...parMois.entries()]
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([cle, e]) => ({
      mois: `${MOIS_COURT[Number(cle.slice(5, 7)) - 1]} ${cle.slice(2, 4)}`,
      total: e.total,
      cloturees: e.clot,
      en_retard: e.retard,
    }));

  const [ad, md] = debut.split("-");
  const [af, mf] = fin.split("-");
  const periode =
    ad === af && md === mf
      ? `${MOIS_FR[Number(md) - 1]} ${ad}`.replace(/^./, (c) => c.toUpperCase())
      : `${fmtJJMMAAAA(debut)} — ${fmtJJMMAAAA(fin)}`;

  return {
    debut,
    fin,
    periode,
    debut_court: fmtCourt(debut),
    fin_court: fmtCourt(fin),
    synthese: {
      total_activites: total,
      cloturees: clotures.length,
      terminees: par("TERMINE"),
      en_cours: par("EN_COURS"),
      standby: par("STANDBY"),
      a_faire: par("A_FAIRE"),
      en_retard: enRetard.length,
      nb_agents: agents.length,
      minutes_total: minutesTotal,
      minutes_realisees: minutesRealisees,
      heures_total: arr2(minutesTotal / 60),
      heures_realisees: arr2(minutesRealisees / 60),
      points_total: arr2(pointsTotal),
      taux_cloture: pct(clotures.length, total),
      taux_retard: pct(enRetard.length, total),
      duree_moyenne_minutes: total ? Math.round(minutesTotal / total) : 0,
    },
    repartition_statut: repartition("statut", activites, libelleStatut, mapCat).sort(
      (a, b) => STATUTS.indexOf(a.cle) - STATUTS.indexOf(b.cle),
    ),
    repartition_priorite: repartition("priorite", activites, libellePriorite, mapCat).sort(
      (a, b) => PRIORITES.indexOf(a.cle) - PRIORITES.indexOf(b.cle),
    ),
    repartition_categorie: repartition("categorie", activites, libelleCategorie, mapCat),
    par_agent: agents,
    activites_en_retard: detailRetard,
    evolution_mensuelle: evolution,
  };
}
