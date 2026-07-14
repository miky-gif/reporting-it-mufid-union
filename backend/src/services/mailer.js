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

/* ------------------------------------------------------------------ */
/* Transports par DÉPARTEMENT                                          */
/* Chaque département peut avoir sa propre boîte d'envoi : les agents  */
/* d'Infrastructure reçoivent alors leurs mails depuis la boîte        */
/* Infrastructure. À défaut, on retombe sur la configuration globale.  */
/* ------------------------------------------------------------------ */
const transportsDep = new Map(); // departement_id -> { transport, from, signature }

/** Construit (et met en cache) le transport d'un département. */
function transportDepartement(dep) {
  if (!dep || !dep.smtp_host || !dep.smtp_pass) return null;
  const signature = `${dep.smtp_host}|${dep.smtp_port}|${dep.smtp_user}|${dep.smtp_pass}|${dep.smtp_tls_insecure}`;
  const cache = transportsDep.get(dep.id);
  if (cache && cache.signature === signature) return cache;

  const port = Number(dep.smtp_port || 587);
  const t = nodemailer.createTransport({
    host: dep.smtp_host,
    port,
    secure: port === 465,
    auth: dep.smtp_user ? { user: dep.smtp_user, pass: dep.smtp_pass } : undefined,
    ...(dep.smtp_tls_insecure ? { tls: { rejectUnauthorized: false } } : {}),
  });
  const entree = {
    transport: t,
    from: dep.mail_from || `MUFID UNION — ${dep.nom} <${dep.smtp_user}>`,
    signature,
  };
  transportsDep.set(dep.id, entree);
  return entree;
}

/** Invalide le cache d'un département (après modification de sa config SMTP). */
export function invaliderTransport(departementId) {
  transportsDep.delete(departementId);
}

/** Vérifie la configuration SMTP d'un département (sans envoyer de message). */
export async function verifierSmtpDepartement(dep) {
  const entree = transportDepartement(dep);
  if (!entree) return { ok: false, raison: "Configuration SMTP incomplète (serveur ou mot de passe manquant)." };
  try {
    await entree.transport.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e.message };
  }
}

/**
 * Envoie un e-mail. Ne lève jamais : en cas d'échec (ou d'absence de SMTP),
 * on journalise et on continue, pour ne pas bloquer l'action métier.
 *
 * `departement` (facultatif) : si le département dispose de sa propre boîte,
 * le message part de celle-ci ; sinon on utilise la configuration globale.
 */
export async function envoyerEmail({ to, subject, text, html, departement = null }) {
  const dep = transportDepartement(departement);
  const envoyeur = dep ? dep.transport : transport;
  const from = dep ? dep.from : MAIL_FROM;

  if (!envoyeur) {
    console.log("📧 [E-mail non envoyé — aucun SMTP configuré]");
    console.log(`   À : ${to}`);
    console.log(`   Sujet : ${subject}`);
    console.log(`   ${text?.replace(/\n/g, "\n   ")}`);
    return { envoye: false, raison: "smtp_non_configure" };
  }
  try {
    await envoyeur.sendMail({ from, to, subject, text, html });
    return { envoye: true, via: dep ? `département ${departement.nom}` : "global" };
  } catch (e) {
    console.error(`✖ Échec d'envoi de l'e-mail à ${to} :`, e.message);
    return { envoye: false, raison: e.message };
  }
}
