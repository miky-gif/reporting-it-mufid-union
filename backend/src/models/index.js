// Définition des modèles et de leurs associations.
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

// Valeurs d'énumération. La CATÉGORIE est désormais dynamique (table categories) :
// les codes ci-dessous ne servent que de valeurs par défaut / repli.
export const ROLES = ["EMPLOYE", "ADMIN"];
export const CATEGORIES_DEFAUT_CODES = [
  "DEVELOPPEMENT",
  "CYBERSECURITE",
  "INFRASTRUCTURE",
  "SUPPORT",
  "MAINTENANCE",
  "REPORTING",
  "AUTRE",
];
export const PRIORITES = ["BASSE", "MOYENNE", "HAUTE", "CRITIQUE"];
export const STATUTS = ["A_FAIRE", "EN_COURS", "TERMINE", "BLOQUE"];

// Table des catégories gérées par l'administrateur (avec leurs rubriques).
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
  },
  { timestamps: false },
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
    date_creation: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    indexes: [{ fields: ["email"] }],
  },
);

export const Activite = sequelize.define(
  "activites",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    titre: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true }, // « État d'exécution » dans le rapport
    // Résultat obtenu / livrable produit (colonne du rapport hebdomadaire).
    livrable: { type: DataTypes.TEXT, allowNull: true },
    // Activités à mener la semaine suivante (colonne du rapport hebdomadaire).
    activites_a_mener: { type: DataTypes.TEXT, allowNull: true },
    // Vrai si la tâche a été affectée par un admin : l'employé ne peut alors
    // en modifier que le statut (pas les autres champs).
    assignee_par_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Code de la catégorie (dynamique) — voir la table categories.
    categorie: { type: DataTypes.STRING(40), allowNull: false },
    priorite: { type: DataTypes.ENUM(...PRIORITES), allowNull: false, defaultValue: "MOYENNE" },
    statut: { type: DataTypes.ENUM(...STATUTS), allowNull: false, defaultValue: "A_FAIRE" },
    date_activite: { type: DataTypes.DATEONLY, allowNull: false },
    duree_heures: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
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
      { fields: ["categorie"] },
      { fields: ["statut"] },
      { fields: ["date_activite"] },
      { fields: ["user_id", "categorie"] },
      { fields: ["user_id", "statut"] },
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

// Associations
User.hasMany(Activite, { foreignKey: "user_id", onDelete: "CASCADE" });
Activite.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Notification, { foreignKey: "user_id", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });
