// Seeding des données de démonstration MUFID UNION.
// Usage : npm run seed  (ou  node src/seed.js)
import { config } from "./config.js";
import { ensureDatabase, sequelize } from "./db.js";
import { Activite, Categorie, User } from "./models/index.js";
import { hacherMotDePasse } from "./security.js";
import { CATEGORIES_DEFAUT } from "./data/categoriesDefaut.js";

// (nom, email, poste, rôle)
const UTILISATEURS = [
  ["Aristide Mbarga", "a.mbarga@mufidunion.cm", "Chef de service IT", "ADMIN"],
  ["Nadège Fotso", "n.fotso@mufidunion.cm", "Développeuse senior", "EMPLOYE"],
  ["Serge Nkodo", "s.nkodo@mufidunion.cm", "Ingénieur Réseau & Infrastructure", "EMPLOYE"],
  ["Chantal Abena", "c.abena@mufidunion.cm", "Analyste Cybersécurité", "EMPLOYE"],
  ["Yves Talla", "y.talla@mufidunion.cm", "Support & Maintenance", "EMPLOYE"],
  ["Estelle Ngono", "e.ngono@mufidunion.cm", "Développeuse / Reporting", "EMPLOYE"],
  ["Boris Etoa", "b.etoa@mufidunion.cm", "Technicien Support", "EMPLOYE"],
];

// [email, titre, catégorie, priorité, statut, joursAvantAujourdhui, durée]
const ACTIVITES = [
  ["n.fotso@mufidunion.cm", "Déploiement du correctif v2.3 — app mobile Épargne", "DEVELOPPEMENT", "HAUTE", "EN_COURS", 2, 3.5],
  ["n.fotso@mufidunion.cm", "Intégration passerelle Mobile Money (MTN / Orange)", "DEVELOPPEMENT", "CRITIQUE", "STANDBY", 4, 5],
  ["n.fotso@mufidunion.cm", "Correction bug rapprochement comptable", "DEVELOPPEMENT", "CRITIQUE", "TERMINE", 7, 3.5],
  ["n.fotso@mufidunion.cm", "Revue de code — module virements internes", "DEVELOPPEMENT", "MOYENNE", "TERMINE", 9, 2],
  ["n.fotso@mufidunion.cm", "Mise en place des tests automatisés (CI)", "DEVELOPPEMENT", "BASSE", "TERMINE", 12, 3],
  ["n.fotso@mufidunion.cm", "Hotfix affichage des soldes — app mobile", "DEVELOPPEMENT", "HAUTE", "TERMINE", 16, 1.5],
  ["n.fotso@mufidunion.cm", "Documentation de l'API interne de virement", "REPORTING", "BASSE", "A_FAIRE", 1, 2],
  ["n.fotso@mufidunion.cm", "Optimisation des requêtes du portail client", "DEVELOPPEMENT", "MOYENNE", "TERMINE", 21, 4],

  ["s.nkodo@mufidunion.cm", "Configuration VPN — nouvelle agence de Bafoussam", "INFRASTRUCTURE", "HAUTE", "TERMINE", 3, 4],
  ["s.nkodo@mufidunion.cm", "Sauvegarde & test de restauration — base clients", "MAINTENANCE", "HAUTE", "TERMINE", 4, 2.5],
  ["s.nkodo@mufidunion.cm", "Remplacement switch défectueux — siège", "INFRASTRUCTURE", "HAUTE", "TERMINE", 5, 1.5],
  ["s.nkodo@mufidunion.cm", "Migration liaison fibre — agence Bafoussam", "INFRASTRUCTURE", "HAUTE", "TERMINE", 8, 4],
  ["s.nkodo@mufidunion.cm", "Maintenance préventive onduleurs — salle serveurs", "MAINTENANCE", "MOYENNE", "TERMINE", 11, 2],
  ["s.nkodo@mufidunion.cm", "Configuration pare-feu périmétrique", "INFRASTRUCTURE", "HAUTE", "TERMINE", 14, 3],
  ["s.nkodo@mufidunion.cm", "Supervision réseau — mise en place sondes", "INFRASTRUCTURE", "MOYENNE", "EN_COURS", 1, 3],
  ["s.nkodo@mufidunion.cm", "Câblage salle de formation — siège", "INFRASTRUCTURE", "BASSE", "A_FAIRE", 0, 2],

  ["c.abena@mufidunion.cm", "Analyse des logs pare-feu — tentatives d'accès Douala", "CYBERSECURITE", "CRITIQUE", "EN_COURS", 2, 2],
  ["c.abena@mufidunion.cm", "Mise à jour antivirus — postes des agences", "CYBERSECURITE", "MOYENNE", "EN_COURS", 5, 3],
  ["c.abena@mufidunion.cm", "Audit des droits d'accès applicatifs", "CYBERSECURITE", "HAUTE", "A_FAIRE", 6, 2.5],
  ["c.abena@mufidunion.cm", "Campagne de sensibilisation au phishing", "CYBERSECURITE", "MOYENNE", "TERMINE", 13, 3.5],
  ["c.abena@mufidunion.cm", "Revue trimestrielle des politiques de mot de passe", "CYBERSECURITE", "HAUTE", "TERMINE", 20, 2],
  ["c.abena@mufidunion.cm", "Test d'intrusion — application de crédit", "CYBERSECURITE", "CRITIQUE", "EN_COURS", 3, 5],

  ["y.talla@mufidunion.cm", "Assistance utilisateurs — réinitialisation comptes SIB", "SUPPORT", "MOYENNE", "TERMINE", 3, 1.5],
  ["y.talla@mufidunion.cm", "Formation utilisateurs — nouveau module crédit", "SUPPORT", "BASSE", "A_FAIRE", 6, 3],
  ["y.talla@mufidunion.cm", "Remplacement imprimante guichet — agence Yaoundé", "MAINTENANCE", "BASSE", "TERMINE", 10, 1],
  ["y.talla@mufidunion.cm", "Support incident messagerie interne", "SUPPORT", "MOYENNE", "TERMINE", 15, 2],
  ["y.talla@mufidunion.cm", "Nettoyage & maintenance postes agences", "MAINTENANCE", "BASSE", "TERMINE", 18, 2.5],
  ["y.talla@mufidunion.cm", "Assistance déploiement lecteurs de badges", "SUPPORT", "MOYENNE", "EN_COURS", 1, 2],

  ["e.ngono@mufidunion.cm", "Rapport mensuel de disponibilité des services", "REPORTING", "MOYENNE", "TERMINE", 5, 2],
  ["e.ngono@mufidunion.cm", "Optimisation requêtes SQL — reporting réglementaire COBAC", "DEVELOPPEMENT", "HAUTE", "EN_COURS", 6, 4],
  ["e.ngono@mufidunion.cm", "Tableau de bord de suivi des encours", "REPORTING", "MOYENNE", "TERMINE", 12, 3],
  ["e.ngono@mufidunion.cm", "Export automatisé des états COBAC", "REPORTING", "HAUTE", "TERMINE", 19, 3.5],
  ["e.ngono@mufidunion.cm", "Refonte du module de statistiques agences", "DEVELOPPEMENT", "MOYENNE", "A_FAIRE", 2, 4],

  ["b.etoa@mufidunion.cm", "Installation postes — nouvelle agence Garoua", "SUPPORT", "MOYENNE", "TERMINE", 8, 3],
  ["b.etoa@mufidunion.cm", "Résolution tickets niveau 1 — semaine", "SUPPORT", "BASSE", "TERMINE", 11, 4],
  ["b.etoa@mufidunion.cm", "Maintenance préventive climatisation salle serveurs", "MAINTENANCE", "MOYENNE", "TERMINE", 17, 2],

  ["a.mbarga@mufidunion.cm", "Revue des rapports d'activités du service", "REPORTING", "HAUTE", "TERMINE", 4, 2],
  ["a.mbarga@mufidunion.cm", "Réunion de coordination sécurité COBAC", "REPORTING", "MOYENNE", "TERMINE", 9, 1.5],
];

function isoMoins(jours) {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

// ⚠ DESTRUCTIF si `force` : supprime toutes les tables puis réinsère la démo.
// Par sécurité, refuse d'écraser une base déjà peuplée sauf si force = true.
export async function executerSeed({ force = false } = {}) {
  await ensureDatabase(); // crée la base si nécessaire
  await sequelize.sync(); // crée les tables si absentes (NON destructif)

  // Garde-fou : ne jamais effacer des données réelles par accident.
  const nbUsers = await User.count().catch(() => 0);
  if (nbUsers > 0 && !force) {
    throw new Error(
      `La base contient déjà ${nbUsers} utilisateur(s) : seeding annulé pour ne pas effacer vos données. ` +
        "Pour réinitialiser volontairement la démo : npm run seed -- --force",
    );
  }

  if (force) await sequelize.sync({ force: true }); // réinitialisation explicite

  // Catégories (avec leurs rubriques) — gérables ensuite par l'admin.
  await Categorie.bulkCreate(
    CATEGORIES_DEFAUT.map((c) => ({
      code: c.code, nom: c.nom, couleur: c.couleur, rubriques: c.rubriques, ordre: c.ordre, actif: true,
    })),
  );

  const mdp = await hacherMotDePasse(config.seedPassword);
  const parEmail = {};
  for (const [nom, email, poste, role] of UTILISATEURS) {
    parEmail[email] = await User.create({ nom_complet: nom, email, poste, role, actif: true, mot_de_passe: mdp });
  }

  // Livrable indicatif par catégorie (colonne « Résultat obtenu » du rapport).
  const LIVRABLE_PAR_CAT = {
    DEVELOPPEMENT: "Version livrée / correctif déployé",
    CYBERSECURITE: "Rapport d'analyse de sécurité",
    INFRASTRUCTURE: "Équipement configuré et opérationnel",
    SUPPORT: "Ticket résolu / utilisateur assisté",
    MAINTENANCE: "Intervention de maintenance consignée",
    REPORTING: "État / tableau de bord produit",
    AUTRE: "Compte rendu",
  };
  const A_MENER = {
    A_FAIRE: "Démarrer l'activité au cours de la semaine.",
    EN_COURS: "Poursuivre et finaliser l'activité.",
    STANDBY: "Lever le point de blocage identifié.",
    TERMINE: "",
    CLOTURE: "",
  };

  const lignes = ACTIVITES.map(([email, titre, cat, prio, statut, jours, duree]) => ({
    user_id: parEmail[email].id,
    titre,
    description: `${titre}. Activité réalisée dans le cadre des opérations du service informatique.`,
    livrable: LIVRABLE_PAR_CAT[cat] ?? null,
    activites_a_mener: A_MENER[statut] || null,
    categorie: cat,
    priorite: prio,
    statut,
    date_activite: isoMoins(jours),
    date_debut: isoMoins(jours + 2),
    date_fin: isoMoins(jours),
    duree_minutes: Math.round(duree * 60),
    duree_heures: duree,
    ...(statut === "CLOTURE" ? { date_cloture: new Date() } : {}),
  }));
  await Activite.bulkCreate(lignes);

  return { users: UTILISATEURS.length, activites: ACTIVITES.length };
}

// Exécution directe (npm run seed  /  npm run seed -- --force)
const estPrincipal = process.argv[1] && process.argv[1].endsWith("seed.js");
if (estPrincipal) {
  const force = process.argv.includes("--force") || process.env.SEED_FORCE === "1";
  executerSeed({ force })
    .then((r) => {
      console.log("✅ Seeding terminé.");
      console.log(`   • ${r.users} utilisateurs, ${r.activites} activités.`);
      console.log(`   • Mot de passe de tous les comptes : ${config.seedPassword}`);
      console.log("   • Admin   : a.mbarga@mufidunion.cm");
      console.log("   • Employé : n.fotso@mufidunion.cm");
      return sequelize.close();
    })
    .catch((e) => {
      console.error("✖ Seeding non effectué :", e.message);
      process.exit(1);
    });
}
