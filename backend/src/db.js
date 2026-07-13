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
export async function ensureColonnes() {
  if (!config.databaseUrl.startsWith("mysql://")) return;

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
      "ADD COLUMN IF NOT EXISTS `cloture_par` INT NULL",
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
}
