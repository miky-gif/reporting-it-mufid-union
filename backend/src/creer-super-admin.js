// Crée UN compte SUPER_ADMIN, pour le tout premier accès à une plateforme
// fraîchement déployée — sans ajouter de données de démonstration
// (contrairement à `npm run seed`, qui crée des utilisateurs et activités
// fictifs). Sans danger sur une base déjà peuplée : refuse si l'e-mail
// existe déjà, et ne touche à rien d'autre.
//
// Usage :
//   node src/creer-super-admin.js --nom "Prénom Nom" --email admin@exemple.cm --mot-de-passe "MotDePasseSolide!"
//
// Ou via variables d'environnement (pratique avec `docker compose exec`) :
//   ADMIN_NOM="Prénom Nom" ADMIN_EMAIL="admin@exemple.cm" ADMIN_MOT_DE_PASSE="MotDePasseSolide!" \
//     node src/creer-super-admin.js
import { ensureDatabase, sequelize } from "./db.js";
import { User } from "./models/index.js";
import { hacherMotDePasse } from "./security.js";

function lireArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    nom: get("--nom") || process.env.ADMIN_NOM,
    email: get("--email") || process.env.ADMIN_EMAIL,
    motDePasse: get("--mot-de-passe") || process.env.ADMIN_MOT_DE_PASSE,
  };
}

async function main() {
  const { nom, email, motDePasse } = lireArgs();

  if (!nom || !email || !motDePasse) {
    console.error("Usage : node src/creer-super-admin.js --nom \"Prénom Nom\" --email admin@exemple.cm --mot-de-passe \"...\"");
    console.error("   (ou variables ADMIN_NOM / ADMIN_EMAIL / ADMIN_MOT_DE_PASSE)");
    process.exitCode = 1;
    return;
  }
  if (motDePasse.length < 8) {
    console.error("✖ Le mot de passe doit compter au moins 8 caractères.");
    process.exitCode = 1;
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`✖ Adresse e-mail invalide : ${email}`);
    process.exitCode = 1;
    return;
  }

  await ensureDatabase();
  await sequelize.sync(); // s'assure que la table users existe (base neuve)

  const existant = await User.findOne({ where: { email } });
  if (existant) {
    console.error(
      `✖ Un compte existe déjà avec l'adresse ${email} (id ${existant.id}, rôle ${existant.role}). Rien n'a été modifié.`,
    );
    process.exitCode = 1;
    return;
  }

  const mdp = await hacherMotDePasse(motDePasse);
  const user = await User.create({
    nom_complet: nom,
    email,
    mot_de_passe: mdp,
    role: "SUPER_ADMIN",
    departement_id: null, // le super admin n'appartient à aucun département : il les voit tous
    permissions: null,
    actif: true,
  });

  console.log(`✔ Super administrateur créé : ${user.nom_complet} <${user.email}> (id ${user.id}).`);
  console.log("  Connectez-vous puis changez ce mot de passe depuis « Mon profil ».");
}

try {
  await main();
} catch (e) {
  console.error("✖ Échec de la création du compte :", e.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
