// Instance Sequelize. Le dialecte (mysql / sqlite) est déduit de l'URL.
import mysql from "mysql2/promise";
import { Sequelize } from "sequelize";
import { config } from "./config.js";

const options = {
  logging: false,
  define: { underscored: false, freezeTableName: true },
};

// Pour SQLite en mémoire (tests), l'URL est « sqlite::memory: ».
export const sequelize = new Sequelize(config.databaseUrl, options);

// Crée la base de données si elle n'existe pas encore (MySQL/MariaDB uniquement).
// Sequelize se connecte à une base existante ; on la provisionne d'abord ici,
// pour éviter à l'utilisateur de la créer manuellement (phpMyAdmin, etc.).
export async function ensureDatabase() {
  if (!config.databaseUrl.startsWith("mysql://")) return;

  const url = new URL(config.databaseUrl);
  const nomBase = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!nomBase) return;

  const connexion = await mysql.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  });
  try {
    await connexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${nomBase}\` ` +
        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
  } finally {
    await connexion.end();
  }
}

// Ajoute, si nécessaire, les colonnes introduites après coup sur des tables
// déjà créées (sequelize.sync() sans `alter` ne modifie pas l'existant).
// MariaDB 10.4 supporte « ADD COLUMN IF NOT EXISTS » : idempotent et sûr.
/** Vrai si la table existe déjà (base non vierge). */
async function tableExiste(nom) {
  const [r] = await sequelize.query("SHOW TABLES LIKE :nom", { replacements: { nom } });
  return r.length > 0;
}

/**
 * Migrations de colonnes. À exécuter AVANT sequelize.sync() : sync() crée les
 * index déclarés dans les modèles, et échouerait si la colonne indexée
 * (ex. departement_id) n'existait pas encore. Sur une base vierge, tout est
 * ignoré (les tables n'existent pas) et sync() se charge de tout créer.
 */
export async function ensureColonnes() {
  if (!config.databaseUrl.startsWith("mysql://")) return;
  if (!(await tableExiste("activites"))) return; // base vierge : rien à migrer

  // 1) Colonnes ajoutées après coup (idempotent).
  await sequelize.query(
    "ALTER TABLE `activites` " +
      "ADD COLUMN IF NOT EXISTS `livrable` TEXT NULL, " +
      "ADD COLUMN IF NOT EXISTS `activites_a_mener` TEXT NULL, " +
      "ADD COLUMN IF NOT EXISTS `assignee_par_admin` TINYINT(1) NOT NULL DEFAULT 0, " +
      "ADD COLUMN IF NOT EXISTS `consignes` TEXT NULL, " +
      "ADD COLUMN IF NOT EXISTS `groupe_affectation_id` VARCHAR(40) NULL, " +
      "ADD COLUMN IF NOT EXISTS `duree_minutes` INT NOT NULL DEFAULT 0, " +
      "ADD COLUMN IF NOT EXISTS `date_debut` DATE NULL, " +
      "ADD COLUMN IF NOT EXISTS `date_fin` DATE NULL, " +
      "ADD COLUMN IF NOT EXISTS `pourcentage` INT NULL, " +
      "ADD COLUMN IF NOT EXISTS `date_cloture` DATETIME NULL, " +
      "ADD COLUMN IF NOT EXISTS `cloture_par` INT NULL, " +
      "ADD COLUMN IF NOT EXISTS `reaffectee_de` INT NULL, " +
      "ADD COLUMN IF NOT EXISTS `date_reaffectation` DATETIME NULL, " +
      "ADD COLUMN IF NOT EXISTS `motif_reaffectation` TEXT NULL",
  );

  // 2) Migration de l'ENUM statut : BLOQUE -> STANDBY, ajout de CLOTURE.
  try {
    await sequelize.query(
      "ALTER TABLE `activites` MODIFY COLUMN `statut` " +
        "ENUM('A_FAIRE','EN_COURS','TERMINE','BLOQUE','STANDBY','CLOTURE') NOT NULL DEFAULT 'A_FAIRE'",
    );
    await sequelize.query("UPDATE `activites` SET `statut`='STANDBY' WHERE `statut`='BLOQUE'");
    await sequelize.query(
      "ALTER TABLE `activites` MODIFY COLUMN `statut` " +
        "ENUM('A_FAIRE','EN_COURS','STANDBY','TERMINE','CLOTURE') NOT NULL DEFAULT 'A_FAIRE'",
    );
  } catch (e) {
    console.error("Migration statut :", e.message);
  }

  // 3) Migration de l'ENUM priorité : ajout de TRES_HAUTE.
  try {
    await sequelize.query(
      "ALTER TABLE `activites` MODIFY COLUMN `priorite` " +
        "ENUM('BASSE','MOYENNE','HAUTE','TRES_HAUTE','CRITIQUE') NOT NULL DEFAULT 'MOYENNE'",
    );
  } catch (e) {
    console.error("Migration priorité :", e.message);
  }

  // 4) Backfill durée en minutes depuis l'ancienne durée en heures.
  await sequelize.query(
    "UPDATE `activites` SET `duree_minutes` = ROUND(`duree_heures`*60) " +
      "WHERE `duree_minutes` = 0 AND `duree_heures` > 0",
  );

  // 5) Backfill période : début = fin = échéance pour les activités existantes.
  await sequelize.query(
    "UPDATE `activites` SET `date_debut` = `date_activite`, `date_fin` = `date_activite` " +
      "WHERE `date_debut` IS NULL OR `date_fin` IS NULL",
  );

  // 6) Gestion des rôles à 3 niveaux : colonnes département + permissions.
  await sequelize.query(
    "ALTER TABLE `users` " +
      "ADD COLUMN IF NOT EXISTS `departement_id` INT NULL, " +
      "ADD COLUMN IF NOT EXISTS `permissions` JSON NULL",
  );
  await sequelize.query("ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `departement_id` INT NULL");
  await sequelize.query("ALTER TABLE `activites` ADD COLUMN IF NOT EXISTS `departement_id` INT NULL");

  // 7) ENUM des rôles : ajout de SUPER_ADMIN.
  try {
    await sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` " +
        "ENUM('EMPLOYE','ADMIN','SUPER_ADMIN') NOT NULL DEFAULT 'EMPLOYE'",
    );
  } catch (e) {
    console.error("Migration rôle :", e.message);
  }
}

/**
 * Amorçage de la gestion des rôles (idempotent, exécuté au démarrage) :
 *  - crée un département par défaut si aucun n'existe ;
 *  - y rattache les utilisateurs / catégories / activités orphelins ;
 *  - promeut le plus ancien administrateur en SUPER_ADMIN s'il n'y en a aucun ;
 *  - dote les administrateurs existants des permissions par défaut.
 * Ne détruit ni ne réinitialise jamais rien.
 */
export async function assurerDepartements() {
  const { Departement, User, Categorie, Activite, PERMISSIONS_DEFAUT } = await import("./models/index.js");

  // Département par défaut : accueille l'existant.
  let total = await Departement.count();
  if (total === 0) {
    await Departement.create({
      code: "EXPLOITATION",
      nom: "Exploitation Système",
      description: "Support, exploitation et arrêtés du réseau MUFID.",
      couleur: "#0E5E7C",
      actif: true,
    });
    await Departement.create({
      code: "INFRASTRUCTURE",
      nom: "Infrastructure",
      description: "Réseau, serveurs, sécurité et matériel.",
      couleur: "#7E57C2",
      actif: true,
    });
    console.log("✔ Départements initialisés (Exploitation Système, Infrastructure).");
  }

  const defaut = await Departement.findOne({ order: [["id", "ASC"]] });
  if (!defaut) return;

  // Rattachement de l'existant (uniquement ce qui n'a pas encore de département).
  await User.update(
    { departement_id: defaut.id },
    { where: { departement_id: null, role: ["EMPLOYE", "ADMIN"] } },
  );
  await Categorie.update({ departement_id: defaut.id }, { where: { departement_id: null } });
  await sequelize.query(
    "UPDATE `activites` a JOIN `users` u ON u.id = a.user_id " +
      "SET a.departement_id = u.departement_id WHERE a.departement_id IS NULL",
  );

  // Un SUPER_ADMIN doit exister : on promeut le plus ancien administrateur.
  const nbSuper = await User.count({ where: { role: "SUPER_ADMIN" } });
  if (nbSuper === 0) {
    const premier = await User.findOne({ where: { role: "ADMIN" }, order: [["id", "ASC"]] });
    if (premier) {
      await premier.update({ role: "SUPER_ADMIN", departement_id: null, permissions: null });
      console.log(`✔ ${premier.nom_complet} <${premier.email}> promu SUPER ADMINISTRATEUR.`);
    }
  }

  // Les admins existants reçoivent les permissions par défaut s'ils n'en ont pas.
  const admins = await User.findAll({ where: { role: "ADMIN" } });
  for (const a of admins) {
    if (!a.permissions) await a.update({ permissions: PERMISSIONS_DEFAUT });
  }
}
