// Point d'entrée : contrôles de production, synchronisation base, serveur HTTP.
import os from "os";
import { config } from "./config.js";
import { ensureColonnes, ensureDatabase, sequelize } from "./db.js";
import "./models/index.js";
import { creerApp } from "./app.js";
import { assurerCategoriesParDefaut } from "./services/categoriesStore.js";

// Simple avertissement si le secret JWT est celui de développement.
// (Non bloquant : la plateforme reste utilisable pour les tests internes.)
function avertirSecretFaible() {
  const s = config.jwtSecret || "";
  if (s.length < 32 || /dev-secret|changer/i.test(s)) {
    console.warn("⚠ JWT_SECRET est celui de développement. Acceptable pour un test interne ;");
    console.warn("  à remplacer par un secret aléatoire si la plateforme sort du réseau local.");
  }
}

// Affiche les adresses LAN utilisables par les postes des IT.
function adressesReseau() {
  const out = [];
  for (const cartes of Object.values(os.networkInterfaces())) {
    for (const c of cartes || []) {
      if (c.family === "IPv4" && !c.internal) out.push(c.address);
    }
  }
  return out;
}

async function demarrer() {
  avertirSecretFaible();

  try {
    await ensureDatabase(); // crée la base si nécessaire
    await sequelize.authenticate();
    await sequelize.sync(); // crée les tables manquantes (non destructif)
    await ensureColonnes(); // migrations de colonnes / ENUM (idempotent)
    await assurerCategoriesParDefaut(); // catégories par défaut si table vide
    console.log("✔ Base de données connectée et synchronisée.");
  } catch (e) {
    console.error("✖ Impossible de se connecter à la base de données :", e.message);
    console.error("  Vérifiez DATABASE_URL dans backend/.env et que MySQL/MariaDB est démarré.");
    process.exit(1);
  }

  const app = creerApp();
  // 0.0.0.0 : accessible depuis les autres postes du réseau local.
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`✔ MUFID UNION — Reporting IT (${config.env}) démarré.`);
    console.log(`   • Local        : http://localhost:${config.port}`);
    for (const ip of adressesReseau()) {
      console.log(`   • Réseau (IT)  : http://${ip}:${config.port}`);
    }
  });
}

demarrer();
