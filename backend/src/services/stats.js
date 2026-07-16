// Calcul des statistiques pour les tableaux de bord (agrégation en JS).
import { Activite, User } from "../models/index.js";
import {
  estEnRetard,
  initiales,
  libelleCategorie,
  libellePriorite,
  libelleStatut,
  pointsEffectifs,
} from "../utils.js";
import { chargerMapCategories } from "./categoriesStore.js";

const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS_FR = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const ORDRE_STATUT = ["CLOTURE", "TERMINE", "EN_COURS", "STANDBY", "A_FAIRE"];

const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const isoJour = (d) => d.toISOString().slice(0, 10);
const minutesOf = (a) => a.duree_minutes || Math.round((a.duree_heures || 0) * 60);
// Points effectifs = automatiques (durée) + ajustement manuel de l'admin.
const pointsOf = (a) => pointsEffectifs(a);
const arr1 = (n) => Math.round(n * 10) / 10;
const arr2 = (n) => Math.round(n * 100) / 100;

function repartitionCategorie(activites, total, mapCat = {}) {
  const compte = {};
  for (const a of activites) compte[a.categorie] = (compte[a.categorie] || 0) + 1;
  return Object.entries(compte)
    .map(([cle, nb]) => ({
      cle,
      libelle: mapCat[cle]?.nom ?? libelleCategorie(cle),
      couleur: mapCat[cle]?.couleur ?? "#8A99A1",
      total: nb,
      pourcentage: pct(nb, total),
    }))
    .sort((x, y) => y.total - x.total);
}

function repartitionStatut(activites, total) {
  const compte = {};
  for (const a of activites) compte[a.statut] = (compte[a.statut] || 0) + 1;
  return ORDRE_STATUT.map((s) => ({
    cle: s,
    libelle: libelleStatut(s),
    total: compte[s] || 0,
    pourcentage: pct(compte[s] || 0, total),
  }));
}

export async function statsEmploye(userId) {
  const activites = await Activite.findAll({ where: { user_id: userId }, raw: true });
  const mapCat = await chargerMapCategories();
  const total = activites.length;

  const compteStatut = {};
  for (const a of activites) compteStatut[a.statut] = (compteStatut[a.statut] || 0) + 1;

  const clotures = activites.filter((a) => a.statut === "CLOTURE");
  // Agrégation en MINUTES (exact) : les heures décimales sont dérivées, jamais sommées.
  const minutesRealisees = clotures.reduce((s, a) => s + minutesOf(a), 0);
  const minutesTotal = activites.reduce((s, a) => s + minutesOf(a), 0);
  const pointsAcquis = clotures.reduce((s, a) => s + pointsOf(a), 0);
  const pointsPotentiels = activites.reduce((s, a) => s + pointsOf(a), 0);

  const enRetard = activites.filter((a) => estEnRetard(a.date_activite, a.statut));
  const activitesEnRetard = enRetard
    .sort((a, b) => (a.date_activite < b.date_activite ? -1 : 1))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      titre: a.titre,
      categorie: mapCat[a.categorie]?.nom ?? libelleCategorie(a.categorie),
      date_activite: a.date_activite,
      statut: libelleStatut(a.statut),
      priorite: libellePriorite(a.priorite),
    }));

  const aujourdhui = new Date();
  const isoAuj = isoJour(aujourdhui);
  const tachesDuJour = activites.filter((a) => a.date_activite === isoAuj).length;

  // Semaine courante (lundi -> dimanche)
  const jour = (aujourdhui.getDay() + 6) % 7;
  const debutSemaine = new Date(aujourdhui);
  debutSemaine.setDate(aujourdhui.getDate() - jour);
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(debutSemaine);
    d.setDate(debutSemaine.getDate() + i);
    return isoJour(d);
  });
  const terminéesSemaine = activites.filter(
    (a) => (a.statut === "TERMINE" || a.statut === "CLOTURE") && jours.includes(a.date_activite),
  ).length;
  const activiteSemaine = jours.map((iso, i) => ({
    jour: JOURS_FR[i],
    valeur: activites.filter((a) => a.date_activite === iso).length,
  }));

  return {
    taches_du_jour: tachesDuJour,
    en_cours: compteStatut.EN_COURS || 0,
    en_standby: compteStatut.STANDBY || 0,
    bloquees: compteStatut.STANDBY || 0, // rétro-compat
    en_retard: enRetard.length,
    terminees_semaine: terminéesSemaine,
    cloturees: clotures.length,
    total_activites: total,
    minutes_realisees: minutesRealisees,
    minutes_total: minutesTotal,
    heures_realisees: arr2(minutesRealisees / 60),
    points_acquis: arr2(pointsAcquis),
    points_potentiels: arr2(pointsPotentiels),
    taux_completion: pct(clotures.length, total),
    repartition_statut: repartitionStatut(activites, total),
    repartition_categorie: repartitionCategorie(activites, total, mapCat),
    activite_semaine: activiteSemaine,
    activites_en_retard: activitesEnRetard,
  };
}

/**
 * Statistiques d'administration.
 * `departementId` : limite au département (admin) ; null = tout (super admin).
 */
export async function statsAdmin(departementId = null) {
  const filtreDep = departementId ? { departement_id: departementId } : {};
  const activites = await Activite.findAll({ where: filtreDep, raw: true });
  const users = await User.findAll({ where: filtreDep, raw: true });
  const mapCat = await chargerMapCategories();
  const total = activites.length;

  const clotures = activites.filter((a) => a.statut === "CLOTURE");
  // Agrégation en MINUTES (exact) : 1 h + 1 h + 1 h + 15 min = 195 min = « 3 h 15 ».
  const minutesRealisees = clotures.reduce((s, a) => s + minutesOf(a), 0);
  const pointsTotal = clotures.reduce((s, a) => s + pointsOf(a), 0);
  const employesActifs = users.filter((u) => u.actif && u.role === "EMPLOYE").length;
  const enRetard = activites.filter((a) => estEnRetard(a.date_activite, a.statut)).length;

  // Charge & contributions par employé (points acquis = tâches clôturées).
  const parUser = new Map();
  for (const a of activites) {
    if (!parUser.has(a.user_id)) parUser.set(a.user_id, { nb: 0, min: 0, ptsAcquis: 0, clot: 0 });
    const e = parUser.get(a.user_id);
    e.nb += 1;
    e.min += minutesOf(a);
    if (a.statut === "CLOTURE") {
      e.ptsAcquis += pointsOf(a);
      e.clot += 1;
    }
  }
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  // On ne classe que les agents (employés), pas les comptes admin.
  const charges = [...parUser.entries()]
    .filter(([uid]) => usersById[uid]?.role === "EMPLOYE")
    .map(([uid, e]) => ({
      user_id: uid,
      nom_complet: usersById[uid]?.nom_complet || `Utilisateur #${uid}`,
      initiales: initiales(usersById[uid]?.nom_complet || ""),
      minutes: e.min,
      heures: arr2(e.min / 60),
      nb_activites: e.nb,
      cloturees: e.clot,
      points: arr2(e.ptsAcquis),
    }));

  const chargeParEmploye = [...charges].sort((a, b) => b.minutes - a.minutes);
  const topContributeurs = [...charges].sort((a, b) => b.points - a.points || b.cloturees - a.cloturees).slice(0, 5);

  // Évolution mensuelle (6 derniers mois)
  const parMois = {};
  for (const a of activites) {
    const cle = a.date_activite.slice(0, 7);
    parMois[cle] = (parMois[cle] || 0) + 1;
  }
  const maintenant = new Date();
  const evolution = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    evolution.push({ mois: MOIS_FR[d.getMonth()], valeur: parMois[cle] || 0 });
  }

  return {
    total_activites: total,
    employes_actifs: employesActifs,
    cloturees: clotures.length,
    en_retard: enRetard,
    taux_completion: pct(clotures.length, total),
    minutes_realisees: minutesRealisees,
    heures_realisees: arr2(minutesRealisees / 60),
    points_total: arr2(pointsTotal),
    repartition_categorie: repartitionCategorie(activites, total, mapCat),
    repartition_statut: repartitionStatut(activites, total),
    charge_par_employe: chargeParEmploye,
    top_contributeurs: topContributeurs,
    evolution_mensuelle: evolution,
  };
}
