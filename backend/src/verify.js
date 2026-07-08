// Vérification HORS BASE de la logique métier (aucun MySQL requis).
// Teste : sécurité, utils, validation zod, calcul des stats, génération PDF/Excel.
//   Lancement : node src/verify.js
import assert from "node:assert";

import { hacherMotDePasse, verifierMotDePasse, creerToken, decoderToken } from "./security.js";
import {
  initiales,
  referenceActivite,
  slugAscii,
  serialiserActivite,
  serialiserUser,
  libelleCategorie,
  libelleStatut,
} from "./utils.js";
import { loginSchema, activiteCreateSchema, userCreateSchema } from "./validators.js";
import { statsEmploye, statsAdmin } from "./services/stats.js";
import { Activite, User } from "./models/index.js";
import { rapportIndividuel, rapportConsolide } from "./services/rapportsData.js";
import { rapportIndividuelPdf, rapportConsolidePdf } from "./services/rapportsPdf.js";
import { rapportIndividuelExcel, rapportConsolideExcel } from "./services/rapportsExcel.js";

let echecs = 0;
function check(nom, cond) {
  console.log(`  [${cond ? "OK " : "ÉCHEC"}] ${nom}`);
  if (!cond) echecs += 1;
}

const iso = (joursAvant) => {
  const d = new Date();
  d.setDate(d.getDate() - joursAvant);
  return d.toISOString().slice(0, 10);
};

console.log("\n=== Sécurité (bcrypt + JWT) ===");
{
  const hash = await hacherMotDePasse("Mufid2026!");
  check("hash != clair", hash !== "Mufid2026!");
  check("vérif mot de passe correct", await verifierMotDePasse("Mufid2026!", hash));
  check("vérif mot de passe faux", !(await verifierMotDePasse("faux", hash)));
  const tok = creerToken(42);
  check("token décodé -> même sub", decoderToken(tok) === "42");
  check("token invalide -> null", decoderToken("abc.def.ghi") === null);
}

console.log("\n=== Utils ===");
{
  check("référence ACT-2041", referenceActivite(41) === "ACT-2041");
  check("initiales 'Nadège Fotso' = NF", initiales("Nadège Fotso") === "NF");
  check("slugAscii sans accents", slugAscii("Nadège Fotso") === "Nadege_Fotso");
  check("slugAscii ASCII pur", /^[A-Za-z0-9_]+$/.test(slugAscii("ÉàïÇ ù!@#")));
  check("libellé catégorie", libelleCategorie("INFRASTRUCTURE") === "Infrastructure/Réseau");
  check("libellé statut", libelleStatut("A_FAIRE") === "À faire");
  const ser = serialiserActivite({ id: 41, user_id: 2, titre: "T", categorie: "SUPPORT", priorite: "HAUTE", statut: "TERMINE", date_activite: "2026-07-01", duree_heures: 2, user: { id: 2, nom_complet: "X", poste: "P" } });
  check("serialiserActivite ajoute la référence", ser.reference === "ACT-2041" && ser.user.nom_complet === "X");
  const su = serialiserUser({ id: 1, nom_complet: "A", email: "a@b.cm", poste: "P", role: "ADMIN", actif: 1, mot_de_passe: "secret" });
  check("serialiserUser masque le mot de passe", su.mot_de_passe === undefined && su.actif === true);
}

console.log("\n=== Validation zod ===");
{
  check("login refuse email invalide", !loginSchema.safeParse({ email: "x", mot_de_passe: "y" }).success);
  check("login accepte valide", loginSchema.safeParse({ email: "a@b.cm", mot_de_passe: "y" }).success);
  check("activité refuse titre court", !activiteCreateSchema.safeParse({ titre: "x", categorie: "SUPPORT", date_activite: "2026-07-01", duree_heures: 2 }).success);
  const ok = activiteCreateSchema.safeParse({ titre: "Titre correct", categorie: "SUPPORT", date_activite: "2026-07-01", duree_heures: "2.5" });
  check("activité coerce durée string->number", ok.success && ok.data.duree_heures === 2.5);
  check("activité refuse catégorie inconnue", !activiteCreateSchema.safeParse({ titre: "Titre ok", categorie: "XXX", date_activite: "2026-07-01", duree_heures: 2 }).success);
  check("user refuse mdp court", !userCreateSchema.safeParse({ nom_complet: "Jean Val", email: "a@b.cm", mot_de_passe: "123" }).success);
}

console.log("\n=== Calcul des stats (données simulées) ===");
{
  // Jeu de données en mémoire, injecté en remplaçant findAll.
  const fixtures = [
    { id: 1, user_id: 2, categorie: "DEVELOPPEMENT", priorite: "HAUTE", statut: "TERMINE", date_activite: iso(0), duree_heures: 3 },
    { id: 2, user_id: 2, categorie: "DEVELOPPEMENT", priorite: "MOYENNE", statut: "EN_COURS", date_activite: iso(1), duree_heures: 2 },
    { id: 3, user_id: 2, categorie: "SUPPORT", priorite: "BASSE", statut: "A_FAIRE", date_activite: iso(2), duree_heures: 1 },
    { id: 4, user_id: 3, categorie: "INFRASTRUCTURE", priorite: "HAUTE", statut: "TERMINE", date_activite: iso(3), duree_heures: 4 },
  ];
  const usersFix = [
    { id: 2, nom_complet: "Nadège Fotso", role: "EMPLOYE", actif: true },
    { id: 3, nom_complet: "Serge Nkodo", role: "EMPLOYE", actif: true },
  ];
  const vraiActFindAll = Activite.findAll;
  const vraiUserFindAll = User.findAll;
  Activite.findAll = async (opts = {}) => {
    const uid = opts?.where?.user_id;
    return uid ? fixtures.filter((f) => f.user_id === uid) : fixtures;
  };
  User.findAll = async () => usersFix;

  const se = await statsEmploye(2);
  check("stats employé : 3 activités", se.total_activites === 3);
  check("stats employé : 6 h cumulées", se.heures_cumulees === 6);
  check("stats employé : complétion 33.3%", se.taux_completion === 33.3);
  check("stats employé : 1 tâche du jour", se.taches_du_jour === 1);
  check("stats employé : semaine = 7 jours", se.activite_semaine.length === 7);

  const sa = await statsAdmin();
  check("stats admin : 4 activités", sa.total_activites === 4);
  check("stats admin : 2 employés actifs", sa.employes_actifs === 2);
  check("stats admin : charge triée par heures", sa.charge_par_employe[0].heures >= sa.charge_par_employe[1].heures);
  check("stats admin : évolution 6 mois", sa.evolution_mensuelle.length === 6);

  Activite.findAll = vraiActFindAll;
  User.findAll = vraiUserFindAll;
}

console.log("\n=== Génération PDF / Excel (données simulées) ===");
{
  const user = { id: 3, nom_complet: "Serge Nkodo", poste: "Ingénieur Réseau & Infra", email: "s.nkodo@mufidunion.cm" };
  const vraiActFindAll = Activite.findAll;
  Activite.findAll = async () => [
    { id: 39, user_id: 3, titre: "Configuration VPN — agence Bafoussam", categorie: "INFRASTRUCTURE", priorite: "HAUTE", statut: "TERMINE", date_activite: "2026-06-30", duree_heures: 4, get: undefined, user },
    { id: 37, user_id: 3, titre: "Sauvegarde base clients", categorie: "MAINTENANCE", priorite: "HAUTE", statut: "TERMINE", date_activite: "2026-06-28", duree_heures: 2.5, user },
  ];
  // rapportsData attend des instances avec .user ; on fournit des objets plats.
  const rapInd = await rapportIndividuel(user, "2026-06-01", "2026-07-31");
  check("rapport individuel : 2 activités", rapInd.nb_activites === 2);
  const pdfInd = await rapportIndividuelPdf(rapInd);
  check("PDF individuel valide", pdfInd.subarray(0, 4).toString() === "%PDF" && pdfInd.length > 1000);
  const xlsInd = await rapportIndividuelExcel(rapInd);
  check("Excel individuel valide (PK)", xlsInd.subarray(0, 2).toString() === "PK");

  const rapCons = await rapportConsolide("2026-06-01", "2026-07-31");
  check("rapport consolidé : agrège les employés", rapCons.nb_employes >= 1);
  const pdfCons = await rapportConsolidePdf(rapCons);
  check("PDF consolidé valide", pdfCons.subarray(0, 4).toString() === "%PDF");
  const xlsCons = await rapportConsolideExcel(rapCons);
  check("Excel consolidé valide (PK)", xlsCons.subarray(0, 2).toString() === "PK");

  Activite.findAll = vraiActFindAll;
}

console.log("");
if (echecs === 0) {
  console.log("✅ VÉRIFICATION HORS BASE : tout est OK.");
  process.exit(0);
} else {
  console.log(`❌ ${echecs} vérification(s) en échec.`);
  process.exit(1);
}
