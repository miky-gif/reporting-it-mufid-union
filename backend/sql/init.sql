-- =====================================================================
--  MUFID UNION — Plateforme de reporting d'activités IT
--  Script d'initialisation de la base de données MySQL 8
-- =====================================================================
--  Usage :
--    mysql -u root -p < init.sql
--  Les tables sont aussi créées automatiquement par Sequelize au
--  démarrage de l'API ; ce script sert de référence et permet une
--  initialisation manuelle. Le remplissage des données de démonstration
--  se fait via :  npm run seed  (depuis le dossier backend)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS mufid_activites
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mufid_activites;

-- ---------------------------------------------------------------------
-- Table des utilisateurs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom_complet   VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe  VARCHAR(255) NOT NULL,
    role          ENUM('EMPLOYE', 'ADMIN') NOT NULL DEFAULT 'EMPLOYE',
    poste         VARCHAR(120) NULL,
    actif         BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Table des activités
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activites (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL,
    titre             VARCHAR(200) NOT NULL,
    description       TEXT NULL,
    categorie         ENUM('DEVELOPPEMENT','CYBERSECURITE','INFRASTRUCTURE',
                           'SUPPORT','MAINTENANCE','REPORTING','AUTRE') NOT NULL,
    priorite          ENUM('BASSE','MOYENNE','HAUTE','CRITIQUE') NOT NULL DEFAULT 'MOYENNE',
    statut            ENUM('A_FAIRE','EN_COURS','TERMINE','BLOQUE') NOT NULL DEFAULT 'A_FAIRE',
    date_activite     DATE NOT NULL,
    duree_heures      FLOAT NOT NULL DEFAULT 0,
    date_creation     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_activites_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    -- Index pour la performance des filtres et agrégations
    INDEX ix_activites_user_id (user_id),
    INDEX ix_activites_categorie (categorie),
    INDEX ix_activites_statut (statut),
    INDEX ix_activites_date_activite (date_activite),
    INDEX ix_activites_user_categorie (user_id, categorie),
    INDEX ix_activites_user_statut (user_id, statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
