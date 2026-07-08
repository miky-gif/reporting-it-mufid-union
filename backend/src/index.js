// Point d'entrée : synchronise la base puis démarre le serveur HTTP.
import { config } from "./config.js";
import { ensureColonnes, ensureDatabase, sequelize } from "./db.js";
import "./models/index.js";
import { creerApp } from "./app.js";
import { assurerCategoriesParDefaut } from "./services/categoriesStore.js";

async function demarrer() {
  try {
    await ensureDatabase(); // crée la base si nécessaire
    await sequelize.authenticate();
    // Crée les tables si elles n'existent pas (équivalent de create_all).
    await sequelize.sync();
    await ensureColonnes(); // colonnes ajoutées après coup (livrable, activites_a_mener)
    await assurerCategoriesParDefaut(); // catégories par défaut si table vide
    console.log("✔ Base de données connectée et synchronisée.");
  } catch (e) {
    console.error("✖ Impossible de se connecter à la base de données :", e.message);
    console.error("  Vérifiez DATABASE_URL dans backend/.env et que MySQL est démarré.");
    process.exit(1);
  }

  const app = creerApp();
  app.listen(config.port, () => {
    console.log(`✔ API MUFID UNION démarrée sur http://localhost:${config.port}`);
  });
}

demarrer();
