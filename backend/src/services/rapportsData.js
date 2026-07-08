// Agrégation des données pour les rapports individuels et consolidés.
import { Op } from "sequelize";
import { Activite, User } from "../models/index.js";
import { libelleCategorie, libellePriorite, libelleStatut, referenceActivite } from "../utils.js";
import { chargerMapCategories } from "./categoriesStore.js";

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_COURT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

// Département affiché en en-tête du rapport (aligné sur le modèle métier).
export const DEPARTEMENT = "Département de l'Exploitation Informatique";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtJJMMAAAA = (iso) => iso.split("-").reverse().join("/");
const fmtCourt = (iso) => {
  const [a, m, j] = iso.split("-");
  return `${Number(j)} ${MOIS_COURT[Number(m) - 1]} ${a}`;
};
const libCat = (code, map) => map[code]?.nom ?? libelleCategorie(code);

// « % réalisation » déduit du statut (le modèle n'a pas de champ dédié).
function pourcentageStatut(statut) {
  if (statut === "TERMINE") return "100%";
  if (statut === "EN_COURS") return "50%";
  return "0%"; // À faire / Bloqué
}

export function periodeLibelle(debut, fin) {
  const [ad, md] = debut.split("-");
  const [af, mf] = fin.split("-");
  if (ad === af && md === mf) return `${cap(MOIS_FR[Number(md) - 1])} ${ad}`;
  return `${fmtJJMMAAAA(debut)} — ${fmtJJMMAAAA(fin)}`;
}

function repartition(compte, total) {
  return Object.entries(compte)
    .map(([libelle, nb]) => ({ libelle, total: nb, pourcentage: total ? Math.round((nb / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);
}

async function activitesPeriode(debut, fin, userId) {
  const where = { date_activite: { [Op.gte]: debut, [Op.lte]: fin } };
  if (userId) where.user_id = userId;
  return Activite.findAll({
    where,
    include: { model: User, as: "user" },
    order: [
      ["date_activite", "DESC"],
      ["id", "DESC"],
    ],
  });
}

export async function rapportIndividuel(user, debut, fin) {
  const activites = await activitesPeriode(debut, fin, user.id);
  const mapCat = await chargerMapCategories();
  const total = activites.length;
  const heures = Math.round(activites.reduce((s, a) => s + a.duree_heures, 0) * 10) / 10;
  const terminees = activites.filter((a) => a.statut === "TERMINE").length;

  const compteCat = {};
  const compteStatut = {};
  for (const a of activites) {
    const cl = libCat(a.categorie, mapCat);
    compteCat[cl] = (compteCat[cl] || 0) + 1;
    const sl = libelleStatut(a.statut);
    compteStatut[sl] = (compteStatut[sl] || 0) + 1;
  }
  const repCat = repartition(compteCat, total);

  return {
    user,
    debut,
    fin,
    periode: periodeLibelle(debut, fin),
    reference: `RAP-IND-${fin.slice(0, 7)}-${String(user.id).padStart(2, "0")}`,
    nb_activites: total,
    heures,
    taux_completion: total ? Math.round((terminees / total) * 1000) / 10 : 0,
    categorie_principale: repCat[0]?.libelle ?? "—",
    repartition_categorie: repCat,
    repartition_statut: repartition(compteStatut, total),
    lignes: activites.map((a) => ({
      reference: referenceActivite(a.id),
      date: fmtJJMMAAAA(a.date_activite),
      titre: a.titre,
      categorie: libCat(a.categorie, mapCat),
      priorite: libellePriorite(a.priorite),
      statut: libelleStatut(a.statut),
      duree: a.duree_heures,
    })),
  };
}

// Transforme une activité en ligne de rapport (colonnes du modèle).
function ligneActivite(a) {
  return {
    programmee: a.titre,
    etat: a.description ?? "",
    livrable: a.livrable ?? "",
    pourcentage: pourcentageStatut(a.statut),
    statut: libelleStatut(a.statut),
    aMener: a.activites_a_mener ?? "",
  };
}

// Regroupe une liste d'activités par catégorie (Rubriques), en conservant
// l'ordre défini par l'admin. Partagé par les rapports individuel et consolidé.
function grouperParCategorie(activites, mapCat) {
  const parCat = new Map();
  for (const a of activites) {
    if (!parCat.has(a.categorie)) parCat.set(a.categorie, []);
    parCat.get(a.categorie).push(a);
  }
  return [...parCat.entries()]
    .map(([code, acts]) => ({
      code,
      rubrique: libCat(code, mapCat),
      couleur: mapCat[code]?.couleur ?? "#64757D",
      ordre: mapCat[code]?.ordre ?? 999,
      lignes: acts
        .slice()
        .sort((a, b) => (a.date_activite < b.date_activite ? -1 : 1))
        .map(ligneActivite),
    }))
    .sort((x, y) => x.ordre - y.ordre);
}

// Rapport individuel « hebdomadaire » calqué sur le modèle métier :
// tableau à 6 colonnes groupé par Rubriques (= catégorie), chaque activité
// devenant une ligne (rubrique = titre, état = description, livrable, %, à mener).
export async function rapportHebdo(user, debut, fin) {
  const activites = await activitesPeriode(debut, fin, user.id);
  const mapCat = await chargerMapCategories();

  return {
    user,
    debut,
    fin,
    periode: periodeLibelle(debut, fin),
    departement: DEPARTEMENT,
    reference: `RAP-HEB-${fin.slice(0, 7)}-${String(user.id).padStart(2, "0")}`,
    debut_court: fmtCourt(debut),
    fin_court: fmtCourt(fin),
    nb_activites: activites.length,
    groupes: grouperParCategorie(activites, mapCat),
  };
}

// Rapport consolidé au même format que l'individuel, mais pour tout le personnel :
// une grille unique où chaque agent (employé) regroupe ses propres Rubriques.
export async function rapportConsolideHebdo(debut, fin) {
  const activites = await activitesPeriode(debut, fin, null);
  const mapCat = await chargerMapCategories();

  // Regroupement par agent (employé).
  const parUser = new Map();
  for (const a of activites) {
    if (!parUser.has(a.user_id)) parUser.set(a.user_id, { user: a.user, acts: [] });
    parUser.get(a.user_id).acts.push(a);
  }
  const employes = [...parUser.values()]
    .map(({ user, acts }) => ({
      user_id: user ? user.id : 0,
      nom_complet: user ? user.nom_complet : "—",
      poste: (user && user.poste) || "",
      nb_activites: acts.length,
      groupes: grouperParCategorie(acts, mapCat),
    }))
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"));

  return {
    debut,
    fin,
    periode: periodeLibelle(debut, fin),
    departement: DEPARTEMENT,
    reference: `RAP-CONS-${fin.slice(0, 7)}`,
    debut_court: fmtCourt(debut),
    fin_court: fmtCourt(fin),
    nb_activites: activites.length,
    nb_employes: parUser.size,
    employes,
  };
}

export async function rapportConsolide(debut, fin) {
  const activites = await activitesPeriode(debut, fin, null);
  const mapCat = await chargerMapCategories();
  const total = activites.length;
  const heures = Math.round(activites.reduce((s, a) => s + a.duree_heures, 0) * 10) / 10;
  const terminees = activites.filter((a) => a.statut === "TERMINE").length;

  const compteCat = {};
  const compteStatut = {};
  const parEmp = new Map();
  for (const a of activites) {
    const cl = libCat(a.categorie, mapCat);
    compteCat[cl] = (compteCat[cl] || 0) + 1;
    const sl = libelleStatut(a.statut);
    compteStatut[sl] = (compteStatut[sl] || 0) + 1;

    if (!parEmp.has(a.user_id)) {
      parEmp.set(a.user_id, { user: a.user, nb: 0, h: 0, term: 0 });
    }
    const e = parEmp.get(a.user_id);
    e.nb += 1;
    e.h += a.duree_heures;
    if (a.statut === "TERMINE") e.term += 1;
  }

  const parEmploye = [...parEmp.values()]
    .map((d) => ({
      nom_complet: d.user ? d.user.nom_complet : "—",
      poste: (d.user && d.user.poste) || "",
      nb_activites: d.nb,
      heures: Math.round(d.h * 10) / 10,
      taux_completion: d.nb ? Math.round((d.term / d.nb) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.heures - a.heures);

  return {
    debut,
    fin,
    periode: periodeLibelle(debut, fin),
    reference: `RAP-CONS-${fin.slice(0, 7)}`,
    nb_activites: total,
    nb_employes: parEmp.size,
    heures,
    taux_completion: total ? Math.round((terminees / total) * 1000) / 10 : 0,
    repartition_categorie: repartition(compteCat, total),
    repartition_statut: repartition(compteStatut, total),
    par_employe: parEmploye,
  };
}
