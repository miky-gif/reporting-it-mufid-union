// Envoi d'e-mails via nodemailer. Optionnel : si aucun SMTP n'est configuré
// dans .env (SMTP_HOST vide), l'e-mail est simplement journalisé en console.
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "MUFID UNION <no-reply@mufidunion.cm>";

const smtpConfigure = Boolean(SMTP_HOST);

let transport = null;
if (smtpConfigure) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
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
