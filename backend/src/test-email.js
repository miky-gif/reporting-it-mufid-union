// Test de la configuration e-mail. Vérifie la connexion au serveur SMTP,
// puis envoie un message de test.
//
//   npm run test-email                    -> envoie à SMTP_USER (soi-même)
//   npm run test-email -- autre@mail.com  -> envoie à l'adresse indiquée
import "dotenv/config";
import { envoyerEmail, verifierSmtp } from "./services/mailer.js";

const destinataire = process.argv[2] || process.env.SMTP_USER;

console.log("Configuration détectée :");
console.log(`   Serveur     : ${process.env.SMTP_HOST || "(vide)"}:${process.env.SMTP_PORT || 587}`);
console.log(`   Compte      : ${process.env.SMTP_USER || "(vide)"}`);
console.log(`   Expéditeur  : ${process.env.MAIL_FROM || "(défaut)"}`);
console.log(`   Mot de passe: ${process.env.SMTP_PASS ? "renseigné" : "(vide)"}\n`);

if (!process.env.SMTP_HOST) {
  console.error("✖ SMTP_HOST est vide dans .env — les e-mails sont seulement journalisés en console.");
  process.exit(1);
}

// 1) Connexion au serveur
console.log("→ Test de connexion au serveur SMTP...");
const v = await verifierSmtp();
if (!v.ok) {
  console.error(`✖ Connexion impossible : ${v.raison}\n`);
  console.error("Pistes :");
  console.error("  • Identifiants incorrects -> vérifiez SMTP_USER / SMTP_PASS");
  console.error("  • Port/chiffrement        -> 587 (STARTTLS) ou 465 (SSL, mettez SMTP_PORT=465)");
  console.error("  • Certificat interne      -> ajoutez SMTP_TLS_INSECURE=true dans .env");
  console.error("  • Pare-feu / réseau       -> le port sortant est-il autorisé ?");
  process.exit(1);
}
console.log("✅ Connexion au serveur SMTP réussie (identifiants valides).\n");

// 2) Envoi réel
if (!destinataire) {
  console.error("✖ Aucun destinataire (ni argument, ni SMTP_USER).");
  process.exit(1);
}
console.log(`→ Envoi d'un e-mail de test à ${destinataire}...`);
const resultat = await envoyerEmail({
  to: destinataire,
  subject: "MUFID UNION — Test d'envoi d'e-mail",
  text:
    "Bonjour,\n\nCeci est un e-mail de test de la plateforme de reporting d'activités IT de MUFID UNION.\n" +
    "Si vous le recevez, la configuration de messagerie fonctionne correctement.\n\n— Plateforme MUFID UNION",
  html:
    "<p>Bonjour,</p><p>Ceci est un <strong>e-mail de test</strong> de la plateforme de reporting " +
    "d'activités IT de MUFID UNION.</p><p>Si vous le recevez, la configuration de messagerie " +
    "fonctionne correctement.</p><p>— Plateforme MUFID UNION</p>",
});

if (resultat.envoye) {
  console.log("✅ E-mail envoyé. Vérifiez la boîte de réception (et les indésirables).");
} else {
  console.error(`✖ Échec de l'envoi : ${resultat.raison}`);
  process.exit(1);
}
