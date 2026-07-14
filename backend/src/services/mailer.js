// Envoi d'e-mails via nodemailer. Optionnel : si aucun SMTP n'est configuré
// dans .env (SMTP_HOST vide), l'e-mail est simplement journalisé en console.
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "MUFID UNION <no-reply@mufidunion.cm>";

// Options utiles pour les serveurs de messagerie professionnels :
// - SMTP_SECURE : force SSL/TLS direct (sinon déduit du port : 465 = oui).
// - SMTP_TLS_INSECURE=true : accepte un certificat auto-signé (serveur interne).
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : SMTP_PORT === 465;
const TLS_INSECURE = process.env.SMTP_TLS_INSECURE === "true";

const smtpConfigure = Boolean(SMTP_HOST);

let transport = null;
if (smtpConfigure) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // 465 -> true ; 587/25 -> false (STARTTLS auto)
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    ...(TLS_INSECURE ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

/** Vérifie la connexion au serveur SMTP (utilisé par le script de test). */
export async function verifierSmtp() {
  if (!smtpConfigure) return { ok: false, raison: "SMTP non configuré (SMTP_HOST vide)." };
  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e.message };
  }
}

/**
 * Envoie un e-mail. Ne lève jamais : en cas d'échec (ou d'absence de SMTP),
 * on journalise et on continue, pour ne pas bloquer l'action métier.
 */
export async function envoyerEmail({ to, subject, text, html }) {
  if (!smtpConfigure) {
    console.log("📧 [E-mail non envoyé — SMTP non configuré]");
    console.log(`   À : ${to}`);
    console.log(`   Sujet : ${subject}`);
    console.log(`   ${text?.replace(/\n/g, "\n   ")}`);
    return { envoye: false, raison: "smtp_non_configure" };
  }
  try {
    await transport.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { envoye: true };
  } catch (e) {
    console.error(`✖ Échec d'envoi de l'e-mail à ${to} :`, e.message);
    return { envoye: false, raison: e.message };
  }
}
