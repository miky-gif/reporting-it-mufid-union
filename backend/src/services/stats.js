// Calcul des statistiques pour les tableaux de bord (agrégation en JS).
import { Activite, User } from "../models/index.js";
import { initiales, libelleCategorie, libelleStatut } from "../utils.js";
import { chargerMapCategories } from "./categoriesStore.js";

const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS_FR = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const ORDRE_STATUT = ["TERMINE", "EN_COURS", "A_FAIRE", "BLOQUE"];

const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const toDate = (s) => new Date(`${s}T00:00:00`);
const isoJour = (d) => d.toISOString().slice(0, 10);

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
  const heures = activites.reduce((s, a) => s + a.duree_heures, 0);

  const compteStatut = {};
  for (const a of activites) compteStatut[a.statut] = (compteStatut[a.statut] || 0) + 1;

  const aujourdhui = new Date();
  const isoAuj = isoJour(aujourdhui);
  const tachesDuJour = activites.filter((a) => a.date_activite === isoAuj).length;

  // Semaine courante (lundi -> dimanche)
  const jour = (aujourdhui.getDay() + 6) % 7; // 0 = lundi
  const debutSemaine = new Date(aujourdhui);
  debutSemaine.setDate(aujourdhui.getDate() - jour);
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(debutSemaine);
    d.setDate(debutSemaine.getDate() + i);
    return isoJour(d);
  });

  const terminees = compteStatut.TERMINE || 0;
  const terminéesSemaine = activites.filter(
    (a) => a.statut === "TERMINE" && jours.includes(a.date_activite),
  ).length;

  const activiteSemaine = jours.map((iso, i) => ({
    jour: JOURS_FR[i],
    valeur: activites.filter((a) => a.date_activite === iso).length,
  }));

  return {
    taches_du_jour: tachesDuJour,
    en_cours: compteStatut.EN_COURS || 0,
    bloquees: compteStatut.BLOQUE || 0,
    terminees_semaine: terminéesSemaine,
    total_activites: total,
    heures_cumulees: Math.round(heures * 10) / 10,
    taux_completion: pct(terminees, total),
    repartition_statut: repartitionStatut(activites, total),
    repartition_categorie: repartitionCategorie(activites, total, mapCat),
    activite_semaine: activiteSemaine,
  };
}

export async function statsAdmin() {
  const activites = await Activite.findAll({ raw: true });
  const users = await User.findAll({ raw: true });
  const mapCat = await chargerMapCategories();
  const total = activites.length;
  const heures = activites.reduce((s, a) => s + a.duree_heures, 0);
  const terminees = activites.filter((a) => a.statut === "TERMINE").length;
  const employesActifs = users.filter((u) => u.actif && u.role === "EMPLOYE").length;

  // Charge & contributions par employé
  const parUser = new Map();
  for (const a of activites) {
    if (!parUser.has(a.user_id)) parUser.set(a.user_id, { nb: 0, h: 0 });
    const e = parUser.get(a.user_id);
    e.nb += 1;
    e.h += a.duree_heures;
  }
  const nomsById = Object.fromEntries(users.map((u) => [u.id, u.nom_complet]));
  const charges = [...parUser.entries()].map(([uid, e]) => ({
    user_id: uid,
    nom_complet: nomsById[uid] || `Utilisateur #${uid}`,
    initiales: initiales(nomsById[uid] || ""),
    heures: Math.round(e.h * 10) / 10,
    nb_activites: e.nb,
  }));

  const chargeParEmploye = [...charges].sort((a, b) => b.heures - a.heures);
  const topContributeurs = [...charges].sort((a, b) => b.nb_activites - a.nb_activites).slice(0, 5);

  // Évolution mensuelle (6 derniers mois)
  const parMois = {};
  for (const a of activites) {
    const cle = a.date_activite.slice(0, 7); // AAAA-MM
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
    taux_completion: pct(terminees, total),
    heures_cumulees: Math.round(heures * 10) / 10,
    repartition_categorie: repartitionCategorie(activites, total, mapCat),
    repartition_statut: repartitionStatut(activites, total),
    charge_par_employe: chargeParEmploye,
    top_contributeurs: topContributeurs,
    evolution_mensuelle: evolution,
  };
}
