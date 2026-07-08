// Test de fumée intégral : vérifie le backend de bout en bout via HTTP.
// Utilise la base configurée dans .env (MySQL). ⚠ RECRÉE les tables (force sync)
// et recharge les données de démo — à lancer sur la base de dev, pas en prod.
//   Prérequis : MySQL démarré + DATABASE_URL correct dans .env.
//   Lancement : npm run smoke
const { executerSeed } = await import("./seed.js");
const { creerApp } = await import("./app.js");

let echecs = 0;
function check(nom, cond) {
  console.log(`  [${cond ? "OK " : "ÉCHEC"}] ${nom}`);
  if (!cond) echecs += 1;
}

// ⚠ Le test de fumée RÉINITIALISE la base (force) : à lancer uniquement sur une
// base de dev/jetable, jamais sur une base contenant des données réelles.
await executerSeed({ force: true });
const app = creerApp();

// Démarre le serveur sur un port éphémère et utilise fetch.
const serveur = app.listen(0);
const port = serveur.address().port;
const base = `http://127.0.0.1:${port}`;

const j = (h = {}) => ({ "Content-Type": "application/json", ...h });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

try {
  console.log("\n=== Auth ===");
  let r = await fetch(`${base}/auth/login`, { method: "POST", headers: j(), body: JSON.stringify({ email: "n.fotso@mufidunion.cm", mot_de_passe: "Mufid2026!" }) });
  check("login employé 200", r.status === 200);
  const empTok = (await r.json()).access_token;

  r = await fetch(`${base}/auth/login`, { method: "POST", headers: j(), body: JSON.stringify({ email: "a.mbarga@mufidunion.cm", mot_de_passe: "Mufid2026!" }) });
  check("login admin 200", r.status === 200);
  const adminTok = (await r.json()).access_token;

  r = await fetch(`${base}/auth/login`, { method: "POST", headers: j(), body: JSON.stringify({ email: "n.fotso@mufidunion.cm", mot_de_passe: "faux" }) });
  check("mauvais mot de passe -> 401", r.status === 401);

  console.log("\n=== Activités (périmètre par rôle) ===");
  r = await fetch(`${base}/activites`, { headers: bearer(empTok) });
  const listeEmp = await r.json();
  check("employé liste ses activités", r.status === 200 && listeEmp.total > 0);
  const totalEmp = listeEmp.total;
  r = await fetch(`${base}/activites`, { headers: bearer(adminTok) });
  const listeAdmin = await r.json();
  check("admin voit plus d'activités", listeAdmin.total > totalEmp);

  r = await fetch(`${base}/activites`, { method: "POST", headers: j(bearer(empTok)), body: JSON.stringify({ titre: "Test smoke activité", categorie: "DEVELOPPEMENT", priorite: "HAUTE", statut: "EN_COURS", date_activite: "2026-07-05", duree_heures: 2.5 }) });
  const creee = await r.json();
  check("employé crée une activité", r.status === 201 && creee.reference.startsWith("ACT-"));

  r = await fetch(`${base}/auth/login`, { method: "POST", headers: j(), body: JSON.stringify({ email: "s.nkodo@mufidunion.cm", mot_de_passe: "Mufid2026!" }) });
  const autreTok = (await r.json()).access_token;
  r = await fetch(`${base}/activites/${creee.id}`, { headers: bearer(autreTok) });
  check("autre employé -> 404 sur activité d'autrui", r.status === 404);

  r = await fetch(`${base}/activites?statut=TERMINE`, { headers: bearer(adminTok) });
  check("filtre par statut", r.status === 200);
  r = await fetch(`${base}/activites?recherche=VPN`, { headers: bearer(adminTok) });
  check("recherche", r.status === 200 && (await r.json()).total >= 1);

  console.log("\n=== Stats ===");
  r = await fetch(`${base}/stats/employe`, { headers: bearer(empTok) });
  check("stats employé", r.status === 200);
  r = await fetch(`${base}/stats/admin`, { headers: bearer(adminTok) });
  const sa = await r.json();
  check("stats admin", r.status === 200 && sa.repartition_categorie.length > 0);
  r = await fetch(`${base}/stats/admin`, { headers: bearer(empTok) });
  check("stats admin interdites à l'employé", r.status === 403);

  console.log("\n=== Utilisateurs (admin) ===");
  r = await fetch(`${base}/users`, { headers: bearer(adminTok) });
  const users = await r.json();
  check("liste utilisateurs (7)", r.status === 200 && users.length === 7);
  check("nb_activites présent", typeof users[0].nb_activites === "number");
  r = await fetch(`${base}/users`, { headers: bearer(empTok) });
  check("users interdit à l'employé", r.status === 403);
  r = await fetch(`${base}/users`, { method: "POST", headers: j(bearer(adminTok)), body: JSON.stringify({ nom_complet: "Test User", email: "test@mufidunion.cm", poste: "Testeur", role: "EMPLOYE", mot_de_passe: "secret123" }) });
  const nouvelUser = await r.json();
  check("création utilisateur 201", r.status === 201);
  // Le nouvel utilisateur reçoit une notification de bienvenue
  r = await fetch(`${base}/auth/login`, { method: "POST", headers: j(), body: JSON.stringify({ email: "test@mufidunion.cm", mot_de_passe: "secret123" }) });
  const nouvelTok = (await r.json()).access_token;
  r = await fetch(`${base}/notifications`, { headers: bearer(nouvelTok) });
  check("notification de bienvenue créée", (await r.json()).items.some((n) => n.type === "BIENVENUE"));

  console.log("\n=== Notifications d'événements ===");
  // Employé crée sa propre tâche -> les admins sont notifiés
  r = await fetch(`${base}/activites`, { method: "POST", headers: j(bearer(empTok)), body: JSON.stringify({ titre: "Correctif / Bug", categorie: "DEVELOPPEMENT", priorite: "MOYENNE", statut: "EN_COURS", date_activite: "2026-07-06", duree_heures: 2 }) });
  const tacheEmp = await r.json();
  check("employé crée une tâche (201)", r.status === 201);
  r = await fetch(`${base}/notifications`, { headers: bearer(adminTok) });
  check("admin notifié de la nouvelle tâche", (await r.json()).items.some((n) => n.type === "NOUVELLE_TACHE" && n.activite_id === tacheEmp.id));

  // Employé change le statut -> admins notifiés
  r = await fetch(`${base}/activites/${tacheEmp.id}`, { method: "PUT", headers: j(bearer(empTok)), body: JSON.stringify({ statut: "TERMINE" }) });
  check("employé change le statut (200)", r.status === 200);
  r = await fetch(`${base}/notifications`, { headers: bearer(adminTok) });
  check("admin notifié du changement de statut", (await r.json()).items.some((n) => n.type === "CHANGEMENT_STATUT" && n.activite_id === tacheEmp.id));

  // Admin modifie la tâche d'un employé -> employé notifié
  r = await fetch(`${base}/activites/${tacheEmp.id}`, { method: "PUT", headers: j(bearer(adminTok)), body: JSON.stringify({ priorite: "HAUTE" }) });
  check("admin modifie la tâche (200)", r.status === 200);
  r = await fetch(`${base}/notifications`, { headers: bearer(empTok) });
  check("employé notifié de la modification", (await r.json()).items.some((n) => n.type === "MODIFICATION_TACHE" && n.activite_id === tacheEmp.id));

  // Admin supprime la tâche d'un employé -> employé notifié
  r = await fetch(`${base}/activites/${tacheEmp.id}`, { method: "DELETE", headers: bearer(adminTok) });
  check("admin supprime la tâche (204)", r.status === 204);
  r = await fetch(`${base}/notifications`, { headers: bearer(empTok) });
  check("employé notifié de la suppression", (await r.json()).items.some((n) => n.type === "SUPPRESSION_TACHE"));

  console.log("\n=== Catégories dynamiques ===");
  r = await fetch(`${base}/categories`, { headers: bearer(empTok) });
  const cats = await r.json();
  check("liste catégories (7 par défaut)", r.status === 200 && cats.length === 7);
  check("catégorie a des rubriques", Array.isArray(cats[0].rubriques) && cats[0].rubriques.length > 0);
  check("employé ne peut pas créer de catégorie", (await fetch(`${base}/categories`, { method: "POST", headers: j(bearer(empTok)), body: JSON.stringify({ nom: "X", couleur: "#111111", rubriques: [] }) })).status === 403);

  r = await fetch(`${base}/categories`, { method: "POST", headers: j(bearer(adminTok)), body: JSON.stringify({ nom: "Base de données", couleur: "#8E44AD", rubriques: ["Optimisation", "Sauvegarde"] }) });
  const nouvelleCat = await r.json();
  check("admin crée une catégorie", r.status === 201 && nouvelleCat.code === "BASE_DE_DONNEES");

  r = await fetch(`${base}/categories/${nouvelleCat.id}`, { method: "PUT", headers: j(bearer(adminTok)), body: JSON.stringify({ nom: "Bases de données", rubriques: ["Optimisation", "Sauvegarde", "Migration"] }) });
  const catMaj = await r.json();
  check("admin modifie la catégorie (nom + rubriques)", r.status === 200 && catMaj.nom === "Bases de données" && catMaj.rubriques.length === 3);

  // Activité avec la nouvelle catégorie
  r = await fetch(`${base}/activites`, { method: "POST", headers: j(bearer(empTok)), body: JSON.stringify({ titre: "Migration", categorie: "BASE_DE_DONNEES", priorite: "MOYENNE", statut: "EN_COURS", date_activite: "2026-07-06", duree_heures: 2 }) });
  check("activité avec catégorie dynamique acceptée", r.status === 201);
  r = await fetch(`${base}/activites`, { method: "POST", headers: j(bearer(empTok)), body: JSON.stringify({ titre: "Test", categorie: "INEXISTANTE", priorite: "MOYENNE", statut: "EN_COURS", date_activite: "2026-07-06", duree_heures: 1 }) });
  check("catégorie inconnue refusée (400)", r.status === 400);

  // Suppression : catégorie utilisée -> désactivée ; inutilisée -> supprimée
  r = await fetch(`${base}/categories/${nouvelleCat.id}`, { method: "DELETE", headers: bearer(adminTok) });
  const suppr = await r.json();
  check("catégorie utilisée -> désactivée", r.status === 200 && suppr.desactivee === true);

  r = await fetch(`${base}/categories`, { method: "POST", headers: j(bearer(adminTok)), body: JSON.stringify({ nom: "Temporaire", couleur: "#333333", rubriques: [] }) });
  const catTmp = await r.json();
  r = await fetch(`${base}/categories/${catTmp.id}`, { method: "DELETE", headers: bearer(adminTok) });
  check("catégorie inutilisée -> supprimée (204)", r.status === 204);

  console.log("\n=== Affectation de tâche + notifications ===");
  // L'employé ne peut pas créer avec le statut « À faire »
  r = await fetch(`${base}/activites`, { method: "POST", headers: j(bearer(empTok)), body: JSON.stringify({ titre: "Rubrique test", categorie: "SUPPORT", priorite: "MOYENNE", statut: "A_FAIRE", date_activite: "2026-07-06", duree_heures: 1 }) });
  check("employé refusé sur statut À faire (400)", r.status === 400);

  // L'admin affecte une tâche À faire à l'employé (user_id = 2 = Nadège)
  r = await fetch(`${base}/activites`, { method: "POST", headers: j(bearer(adminTok)), body: JSON.stringify({ user_id: 2, titre: "Nouvelle fonctionnalité", categorie: "DEVELOPPEMENT", priorite: "HAUTE", statut: "A_FAIRE", date_activite: "2026-07-10", duree_heures: 4, description: "Tâche affectée par test" }) });
  const affectee = await r.json();
  check("admin affecte une tâche À faire", r.status === 201 && affectee.statut === "A_FAIRE" && affectee.user_id === 2);

  // L'employé reçoit la notification
  r = await fetch(`${base}/notifications`, { headers: bearer(empTok) });
  const notifs = await r.json();
  check("employé a une notification non lue", r.status === 200 && notifs.non_lues >= 1);
  const notifAffect = notifs.items.find((n) => n.type === "AFFECTATION" && n.activite_id === affectee.id);
  check("notification d'affectation présente", !!notifAffect);

  // Marquer comme lue
  r = await fetch(`${base}/notifications/${notifAffect.id}/lu`, { method: "POST", headers: bearer(empTok) });
  check("marquer la notification comme lue", r.status === 200);
  r = await fetch(`${base}/notifications`, { headers: bearer(empTok) });
  check("compteur non lues décrémenté", (await r.json()).non_lues === notifs.non_lues - 1);

  // La tâche affectée apparaît bien chez l'employé
  r = await fetch(`${base}/activites?statut=A_FAIRE`, { headers: bearer(empTok) });
  check("tâche À faire visible chez l'employé", (await r.json()).items.some((a) => a.id === affectee.id));

  console.log("\n=== Rapports (Word / PDF) ===");
  const p = "user_id=2&date_debut=2026-06-01&date_fin=2026-07-31";
  r = await fetch(`${base}/rapports/individuel?${p}&format=pdf`, { headers: bearer(adminTok) });
  let buf = Buffer.from(await r.arrayBuffer());
  check("PDF individuel", r.status === 200 && buf.subarray(0, 4).toString() === "%PDF" && buf.length > 1000);
  r = await fetch(`${base}/rapports/individuel?${p}&format=word`, { headers: bearer(adminTok) });
  buf = Buffer.from(await r.arrayBuffer());
  check("Word individuel (docx/zip)", r.status === 200 && buf.subarray(0, 2).toString() === "PK" && buf.length > 1000);
  r = await fetch(`${base}/rapports/individuel/apercu?${p}`, { headers: bearer(adminTok) });
  const apInd = await r.json();
  check("aperçu individuel groupé (groupes[])", r.status === 200 && Array.isArray(apInd.groupes) && typeof apInd.debut_court === "string");
  r = await fetch(`${base}/rapports/consolide?date_debut=2026-06-01&date_fin=2026-07-31&format=pdf`, { headers: bearer(adminTok) });
  buf = Buffer.from(await r.arrayBuffer());
  check("PDF consolidé", r.status === 200 && buf.subarray(0, 4).toString() === "%PDF");
  r = await fetch(`${base}/rapports/consolide?date_debut=2026-06-01&date_fin=2026-07-31&format=word`, { headers: bearer(adminTok) });
  buf = Buffer.from(await r.arrayBuffer());
  check("Word consolidé (docx/zip)", r.status === 200 && buf.subarray(0, 2).toString() === "PK" && buf.length > 1000);
  r = await fetch(`${base}/rapports/consolide/apercu?date_debut=2026-06-01&date_fin=2026-07-31`, { headers: bearer(adminTok) });
  const ap = await r.json();
  check("aperçu consolidé groupé (employes[])", r.status === 200 && ap.nb_employes > 0 && Array.isArray(ap.employes) && Array.isArray(ap.employes[0].groupes));
  r = await fetch(`${base}/rapports/consolide/apercu?date_debut=2026-06-01&date_fin=2026-07-31`, { headers: bearer(empTok) });
  check("rapports interdits à l'employé", r.status === 403);
} finally {
  serveur.close();
}

if (echecs === 0) {
  console.log("\n✅ TOUS LES TESTS DE FUMÉE SONT PASSÉS.");
  process.exit(0);
} else {
  console.log(`\n❌ ${echecs} test(s) en échec.`);
  process.exit(1);
}
