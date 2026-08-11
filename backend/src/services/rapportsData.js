// Agrégation des données pour les rapports individuels et consolidés.
import { Op } from "sequelize";
import { Activite, Departement, User } from "../models/index.js";
import {
  libelleCategorie,
  libelleDepartement,
  libellePriorite,
  libelleStatut,
  pourcentageEffectif,
  referenceActivite,
} from "../utils.js";
import { chargerMapCategories } from "./categoriesStore.js";
import { libelleEnteteDepartement } from "./enteteDepartement.js";

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_COURT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

// En-tête de rapport quand aucun département n'est déterminé (repli).
export const DEPARTEMENT_DEFAUT = "Direction des Systèmes d'Information";

/** Libellé d'en-tête du département d'un agent (dynamique). */
async function enteteDepartementDe(user) {
  if (!user?.departement_id) return DEPARTEMENT_DEFAUT;
  const dep = user.departement ?? (await Departement.findByPk(user.departement_id));
  return dep ? libelleDepartement(dep.nom) : DEPARTEMENT_DEFAUT;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtJJMMAAAA = (iso) => iso.split("-").reverse().join("/");
const fmtCourt = (iso) => {
  const [a, m, j] = iso.split("-");
  return `${Number(j)} ${MOIS_COURT[Number(m) - 1]} ${a}`;
};
const libCat = (code, map) => map[code]?.nom ?? libelleCategorie(code);

const joursEntre = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const ajouterJours = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Détecte le TYPE de rapport d'après la durée de la période choisie et fournit
 * le libellé de la période suivante (pour le tableau « Activités à mener »).
 *   ex. 01/01 -> 02/02 (~33 j) = « Mensuel » / « mois suivant ».
 */
export function typePeriode(debut, fin) {
  const jours = joursEntre(debut, fin) + 1; // nombre de jours inclusifs
  if (jours <= 10) return { code: "HEBDO", label: "Hebdomadaire", suivant: "semaine suivante" };
  if (jours <= 45) return { code: "MENSUEL", label: "Mensuel", suivant: "mois suivant" };
  if (jours <= 100) return { code: "TRIMESTRIEL", label: "Trimestriel", suivant: "trimestre suivant" };
  if (jours <= 250) return { code: "SEMESTRIEL", label: "Semestriel", suivant: "semestre suivant" };
  return { code: "ANNUEL", label: "Annuel", suivant: "année suivante" };
}

// Période immédiatement suivante, de même durée que celle filtrée.
function periodeSuivante(debut, fin) {
  const span = joursEntre(debut, fin); // écart en jours
  const sDebut = ajouterJours(fin, 1);
  return { debut: sDebut, fin: ajouterJours(sDebut, span) };
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

async function activitesPeriode(debut, fin, userId, departementId = null) {
  const where = { date_activite: { [Op.gte]: debut, [Op.lte]: fin } };
  if (userId) where.user_id = userId;
  if (departementId) where.departement_id = departementId; // cloisonnement
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
// La colonne « Activités à mener » a été retirée : elle est remplacée par un
// second tableau alimenté par les tâches réellement programmées ensuite.
function ligneActivite(a) {
  return {
    programmee: a.titre,
    etat: a.description ?? "",
    livrable: a.livrable ?? "",
    // % réalisation : valeur saisie si présente, sinon déduite du statut.
    pourcentage: `${pourcentageEffectif(a.pourcentage, a.statut)}%`,
    statut: libelleStatut(a.statut),
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

// Regroupe une liste d'activités par agent, puis par catégorie (rapport consolidé).
function grouperParEmploye(activites, mapCat) {
  const parUser = new Map();
  for (const a of activites) {
    if (!parUser.has(a.user_id)) parUser.set(a.user_id, { user: a.user, acts: [] });
    parUser.get(a.user_id).acts.push(a);
  }
  return [...parUser.values()]
    .map(({ user, acts }) => ({
      user_id: user ? user.id : 0,
      nom_complet: user ? user.nom_complet : "—",
      poste: (user && user.poste) || "",
      nb_activites: acts.length,
      groupes: grouperParCategorie(acts, mapCat),
    }))
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"));
}

// Rapport individuel « hebdomadaire » calqué sur le modèle métier :
// tableau à 6 colonnes groupé par Rubriques (= catégorie), chaque activité
// devenant une ligne (rubrique = titre, état = description, livrable, %, à mener).
export async function rapportHebdo(user, debut, fin) {
  const mapCat = await chargerMapCategories();
  const type = typePeriode(debut, fin);
  const suiv = periodeSuivante(debut, fin);

  const activites = await activitesPeriode(debut, fin, user.id);
  // Activités à mener = tâches programmées dans la période suivante (même durée).
  const activitesAMener = await activitesPeriode(suiv.debut, suiv.fin, user.id);

  return {
    user,
    debut,
    fin,
    periode: periodeLibelle(debut, fin),
    type_label: type.label, // Hebdomadaire / Mensuel / Annuel…
    suivant_label: type.suivant, // « mois suivant », « année suivante »…
    // En-tête dynamique : le département de l'agent concerné.
    departement: await enteteDepartementDe(user),
    reference: `RAP-HEB-${fin.slice(0, 7)}-${String(user.id).padStart(2, "0")}`,
    debut_court: fmtCourt(debut),
    fin_court: fmtCourt(fin),
    debut_suivant_court: fmtCourt(suiv.debut),
    fin_suivant_court: fmtCourt(suiv.fin),
    nb_activites: activites.length,
    nb_a_mener: activitesAMener.length,
    groupes: grouperParCategorie(activites, mapCat),
    groupes_a_mener: grouperParCategorie(activitesAMener, mapCat),
  };
}

// Rapport consolidé au même format que l'individuel, mais pour tout le personnel :
// une grille unique où chaque agent (employé) regroupe ses propres Rubriques.
export async function rapportConsolideHebdo(debut, fin, departementId = null) {
  const mapCat = await chargerMapCategories();
  const type = typePeriode(debut, fin);
  const suiv = periodeSuivante(debut, fin);

  const activites = await activitesPeriode(debut, fin, null, departementId);
  const activitesAMener = await activitesPeriode(suiv.debut, suiv.fin, null, departementId);

  // En-tête : le(s) département(s) consolidé(s), ou « tous » (super admin).
  const entete = await libelleEnteteDepartement(departementId ?? null);

  const employes = grouperParEmploye(activites, mapCat);
  const employesAMener = grouperParEmploye(activitesAMener, mapCat);

  return {
    debut,
    fin,
    periode: periodeLibelle(debut, fin),
    type_label: type.label,
    suivant_label: type.suivant,
    departement: entete,
    reference: `RAP-CONS-${fin.slice(0, 7)}`,
    debut_court: fmtCourt(debut),
    fin_court: fmtCourt(fin),
    debut_suivant_court: fmtCourt(suiv.debut),
    fin_suivant_court: fmtCourt(suiv.fin),
    nb_activites: activites.length,
    nb_a_mener: activitesAMener.length,
    nb_employes: employes.length,
    employes,
    employes_a_mener: employesAMener,
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
