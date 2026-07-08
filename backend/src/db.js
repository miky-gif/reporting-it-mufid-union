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
  await sequelize.query(
    "ALTER TABLE `activites` " +
      "ADD COLUMN IF NOT EXISTS `livrable` TEXT NULL, " +
      "ADD COLUMN IF NOT EXISTS `activites_a_mener` TEXT NULL, " +
      "ADD COLUMN IF NOT EXISTS `assignee_par_admin` TINYINT(1) NOT NULL DEFAULT 0",
  );
}
