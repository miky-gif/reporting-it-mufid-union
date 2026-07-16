// Définition des modèles et de leurs associations.
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

// Valeurs d'énumération. La CATÉGORIE est désormais dynamique (table categories) :
// les codes ci-dessous ne servent que de valeurs par défaut / repli.
//
// Rôles (3 niveaux) :
//   SUPER_ADMIN : voit tout, crée les départements, les admins et leurs droits.
//   ADMIN       : rattaché à UN département, cloisonné, droits granulaires.
//   EMPLOYE     : l'agent IT, rattaché à UN département.
export const ROLES = ["EMPLOYE", "ADMIN", "SUPER_ADMIN"];

// Catalogue des droits attribuables à un ADMIN par le super admin.
// (Le SUPER_ADMIN les possède tous implicitement.)
export const PERMISSIONS = {
  IT_CREER: "Créer des agents IT",
  IT_MODIFIER: "Modifier des agents IT",
  IT_DESACTIVER: "Désactiver des agents IT",
  CATEGORIES_GERER: "Gérer les catégories et rubriques",
  TACHES_AFFECTER: "Affecter des tâches",
  TACHES_MODIFIER: "Modifier les tâches",
  TACHES_REAFFECTER: "Réaffecter les tâches",
  TACHES_CLOTURER: "Clôturer (valider) les tâches",
  TACHES_SUPPRIMER: "Supprimer des tâches",
  STATISTIQUES_VOIR: "Consulter les statistiques",
  RAPPORTS_EXPORTER: "Générer et exporter les rapports",
};
export const CODES_PERMISSIONS = Object.keys(PERMISSIONS);

// Droits attribués par défaut à un nouvel admin (le super admin peut ajuster).
export const PERMISSIONS_DEFAUT = [
  "IT_CREER",
  "IT_MODIFIER",
  "CATEGORIES_GERER",
  "TACHES_AFFECTER",
  "TACHES_MODIFIER",
  "TACHES_REAFFECTER",
  "TACHES_CLOTURER",
  "STATISTIQUES_VOIR",
  "RAPPORTS_EXPORTER",
];
export const CATEGORIES_DEFAUT_CODES = [
  "DEVELOPPEMENT",
  "CYBERSECURITE",
  "INFRASTRUCTURE",
  "SUPPORT",
  "MAINTENANCE",
  "REPORTING",
  "AUTRE",
];
export const PRIORITES = ["BASSE", "MOYENNE", "HAUTE", "TRES_HAUTE", "CRITIQUE"];
export const STATUTS = ["A_FAIRE", "EN_COURS", "STANDBY", "TERMINE", "CLOTURE"];
// Fréquences de récurrence d'une tâche.
export const RECURRENCES = ["AUCUNE", "JOUR", "SEMAINE", "MOIS"];
// Points : référence 40 h de travail = 5 points -> 1 point = 480 minutes.
export const MINUTES_PAR_POINT = 480;

// Départements de la direction (Exploitation Système, Infrastructure, …).
// Créés dynamiquement par le SUPER_ADMIN. Chacun peut avoir sa propre boîte
// d'envoi SMTP : les notifications de ses agents partent alors de cette boîte.
export const Departement = sequelize.define(
  "departements",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    nom: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    couleur: { type: DataTypes.STRING(9), allowNull: false, defaultValue: "#0E5E7C" },
    actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Configuration e-mail propre au département (facultative : repli sur .env).
    smtp_host: { type: DataTypes.STRING(150), allowNull: true },
    smtp_port: { type: DataTypes.INTEGER, allowNull: true },
    smtp_user: { type: DataTypes.STRING(150), allowNull: true },
    smtp_pass: { type: DataTypes.STRING(255), allowNull: true },
    smtp_tls_insecure: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    mail_from: { type: DataTypes.STRING(200), allowNull: true },
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { timestamps: false },
);

// Table des catégories gérées par l'administrateur (avec leurs rubriques).
// Chaque catégorie appartient à UN département (métiers différents).
export const Categorie = sequelize.define(
  "categories",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    nom: { type: DataTypes.STRING(80), allowNull: false },
    couleur: { type: DataTypes.STRING(9), allowNull: false, defaultValue: "#64757D" },
    // Liste des rubriques (tableau de chaînes) stockée en JSON.
    rubriques: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    ordre: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    departement_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { timestamps: false, indexes: [{ fields: ["departement_id"] }] },
);

export const User = sequelize.define(
  "users",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nom_complet: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    mot_de_passe: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM(...ROLES), allowNull: false, defaultValue: "EMPLOYE" },
    poste: { type: DataTypes.STRING(120), allowNull: true },
    actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Rattachement au département (null pour le SUPER_ADMIN : il les voit tous).
    departement_id: { type: DataTypes.INTEGER, allowNull: true },
    // Droits granulaires d'un ADMIN (tableau de codes). Ignoré pour les autres rôles.
    permissions: { type: DataTypes.JSON, allowNull: true },
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    indexes: [{ fields: ["email"] }, { fields: ["departement_id"] }, { fields: ["role"] }],
  },
);

export const Activite = sequelize.define(
  "activites",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    // Département de l'agent au moment de l'affectation (dénormalisé : permet
    // un cloisonnement simple et rapide des listes, stats et rapports).
    departement_id: { type: DataTypes.INTEGER, allowNull: true },
    titre: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true }, // « État d'exécution de l'activité »
    // Consigne de départ (attentes/instructions) — modifiable par l'admin uniquement.
    consignes: { type: DataTypes.TEXT, allowNull: true },
    // Résultat attendu / livrable produit (colonne du rapport hebdomadaire).
    livrable: { type: DataTypes.TEXT, allowNull: true },
    // Activités à mener la semaine suivante (colonne du rapport hebdomadaire).
    activites_a_mener: { type: DataTypes.TEXT, allowNull: true },
    // Vrai si la tâche a été affectée par un admin : l'employé ne peut alors
    // modifier que le statut et l'état d'exécution (pas les consignes ni les autres champs).
    assignee_par_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Relie les instances d'une même affectation à plusieurs agents.
    groupe_affectation_id: { type: DataTypes.STRING(40), allowNull: true },
    // Code de la catégorie (dynamique) — voir la table categories.
    categorie: { type: DataTypes.STRING(40), allowNull: false },
    priorite: { type: DataTypes.ENUM(...PRIORITES), allowNull: false, defaultValue: "MOYENNE" },
    statut: { type: DataTypes.ENUM(...STATUTS), allowNull: false, defaultValue: "A_FAIRE" },
    // Pourcentage de réalisation (0-100). Si null -> déduit du statut.
    pourcentage: { type: DataTypes.INTEGER, allowNull: true },
    // Ajustement manuel des points par l'admin (bonus si +, malus si -).
    // Le score final = points automatiques (durée) + cet ajustement, borné à 0.
    points_ajustement: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    // Échéance (= fin de période) — conservée pour compatibilité (tri, retard, rapports).
    date_activite: { type: DataTypes.DATEONLY, allowNull: false },
    // Période de réalisation de la tâche (début -> fin).
    date_debut: { type: DataTypes.DATEONLY, allowNull: true },
    date_fin: { type: DataTypes.DATEONLY, allowNull: true },
    // Durée canonique en minutes (granularité fine : 15 min possible).
    duree_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Durée en heures dérivée (conservée pour compat. affichage/stats).
    duree_heures: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    // Validation finale par l'admin (clôture).
    date_cloture: { type: DataTypes.DATE, allowNull: true },
    cloture_par: { type: DataTypes.INTEGER, allowNull: true },
    // Réaffectation : trace de l'agent précédent, quand et pourquoi.
    reaffectee_de: { type: DataTypes.INTEGER, allowNull: true },
    date_reaffectation: { type: DataTypes.DATE, allowNull: true },
    motif_reaffectation: { type: DataTypes.TEXT, allowNull: true },
    // Récurrence : une tâche « modèle » régénère automatiquement de nouvelles
    // occurrences (JOUR/SEMAINE/MOIS). Les occurrences générées portent
    // recurrence = AUCUNE et pointent vers le modèle via recurrence_parent_id.
    recurrence: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "AUCUNE" },
    recurrence_fin: { type: DataTypes.DATEONLY, allowNull: true }, // date de fin (facultative)
    recurrence_prochaine: { type: DataTypes.DATEONLY, allowNull: true }, // prochaine génération
    recurrence_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    recurrence_parent_id: { type: DataTypes.INTEGER, allowNull: true },
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    date_modification: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    hooks: {
      beforeUpdate: (activite) => {
        activite.date_modification = new Date();
      },
    },
    // Index de performance pour les filtres et agrégations.
    indexes: [
      { fields: ["user_id"] },
      { fields: ["departement_id"] },
      { fields: ["categorie"] },
      { fields: ["statut"] },
      { fields: ["date_activite"] },
      { fields: ["user_id", "categorie"] },
      { fields: ["user_id", "statut"] },
      { fields: ["recurrence", "recurrence_active", "recurrence_prochaine"] },
    ],
  },
);

export const Notification = sequelize.define(
  "notifications",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false }, // destinataire
    type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "AFFECTATION" },
    titre: { type: DataTypes.STRING(160), allowNull: false },
    message: { type: DataTypes.STRING(400), allowNull: false },
    activite_id: { type: DataTypes.INTEGER, allowNull: true },
    lu: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    indexes: [{ fields: ["user_id", "lu"] }, { fields: ["user_id", "date_creation"] }],
  },
);

// Pièces jointes rattachées à une activité (rapports numérisés, etc.).
export const PieceJointe = sequelize.define(
  "pieces_jointes",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    activite_id: { type: DataTypes.INTEGER, allowNull: false },
    nom_fichier: { type: DataTypes.STRING(255), allowNull: false },
    fichier: { type: DataTypes.STRING(255), allowNull: false }, // nom stocké sur disque
    mime: { type: DataTypes.STRING(120), allowNull: true },
    taille: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    televerse_par: { type: DataTypes.INTEGER, allowNull: true },
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { timestamps: false, indexes: [{ fields: ["activite_id"] }] },
);

// Associations
Departement.hasMany(User, { foreignKey: "departement_id", as: "membres" });
User.belongsTo(Departement, { foreignKey: "departement_id", as: "departement" });
Departement.hasMany(Categorie, { foreignKey: "departement_id", as: "categories" });
Categorie.belongsTo(Departement, { foreignKey: "departement_id", as: "departement" });
Departement.hasMany(Activite, { foreignKey: "departement_id", as: "activites" });
Activite.belongsTo(Departement, { foreignKey: "departement_id", as: "departement" });

User.hasMany(Activite, { foreignKey: "user_id", onDelete: "CASCADE" });
Activite.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Notification, { foreignKey: "user_id", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });
Activite.hasMany(PieceJointe, { foreignKey: "activite_id", as: "pieces", onDelete: "CASCADE" });
PieceJointe.belongsTo(Activite, { foreignKey: "activite_id", as: "activite" });
