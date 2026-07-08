// Test d'envoi d'e-mail réel. Usage :
//   node src/test-email.js                 -> envoie à SMTP_USER (soi-même)
//   node src/test-email.js autre@mail.com  -> envoie à l'adresse indiquée
// Vérifie d'abord que SMTP_HOST/SMTP_USER/SMTP_PASS sont bien renseignés dans .env.
import "dotenv/config";
import { envoyerEmail } from "./services/mailer.js";

const destinataire = process.argv[2] || process.env.SMTP_USER;

if (!process.env.SMTP_HOST) {
  console.error("✖ SMTP_HOST est vide dans .env — configurez-le d'abord (smtp.gmail.com).");
  process.exit(1);
}
if (!process.env.SMTP_PASS) {
  console.error("✖ SMTP_PASS est vide dans .env — collez votre mot de passe d'application Gmail.");
  process.exit(1);
}
if (!destinataire) {
  console.error("✖ Aucun destinataire (ni argument, ni SMTP_USER).");
  process.exit(1);
}

console.log(`→ Envoi d'un e-mail de test à ${destinataire} via ${process.env.SMTP_HOST}...`);

const resultat = await envoyerEmail({
  to: destinataire,
  subject: "MUFID UNION — Test d'envoi d'e-mail",
  text:
    "Bonjour,\n\nCeci est un e-mail de test de la plateforme MUFID UNION.\n" +
    "Si vous le recevez, la configuration SMTP fonctionne correctement.\n\n— Plateforme MUFID UNION",
  html:
    "<p>Bonjour,</p><p>Ceci est un <strong>e-mail de test</strong> de la plateforme " +
    "MUFID UNION.</p><p>Si vous le recevez, la configuration SMTP fonctionne correctement.</p>" +
    "<p>— Plateforme MUFID UNION</p>",
});

if (resultat.envoye) {
  console.log("✅ E-mail envoyé avec succès. Vérifiez la boîte de réception.");
} else {
  console.error(`✖ Échec : ${resultat.raison}`);
  process.exit(1);
}
