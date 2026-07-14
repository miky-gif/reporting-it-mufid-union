// Service de notifications : notifications internes (plateforme) et e-mails.
// Chaque fonction d'événement crée les notifications internes nécessaires et
// déclenche les e-mails (best-effort : jamais bloquant pour l'action métier).
import { Notification, User } from "../models/index.js";
import { libelleCategorie, libellePriorite, libelleStatut } from "../utils.js";
import { envoyerEmail } from "./mailer.js";

const dateFr = (iso) => String(iso).split("-").reverse().join("/");

/** Liste des administrateurs actifs (destinataires des alertes de supervision). */
async function listerAdmins() {
  return User.findAll({ where: { role: "ADMIN", actif: true } });
}

/** Crée une notification interne pour un utilisateur. */
async function creerNotif({ userId, type, titre, message, activiteId = null }) {
  return Notification.create({ user_id: userId, type, titre, message, activite_id: activiteId, lu: false });
}

// ---------------------------------------------------------------------------
// Gabarit HTML d'e-mail (aux couleurs MUFID UNION, compatible clients mail).
// ---------------------------------------------------------------------------
function emailHtml({ titre, salutation, intro, lignes = [], conclusion }) {
  const table = lignes.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:collapse">${lignes
        .map(
          (l) =>
            `<tr><td style="padding:5px 16px 5px 0;color:#5E717B;font:400 13px Arial,sans-serif">${l.label}</td>` +
            `<td style="padding:5px 0;color:#16262E;font:700 13px Arial,sans-serif">${l.valeur}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  return `
  <div style="background:#E9EDEF;padding:24px;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E2E8EB;border-radius:12px;overflow:hidden">
      <div style="background:#093646;padding:18px 24px">
        <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:.5px">MUFID <span style="color:#8FB2BF">UNION</span></span>
      </div>
      <div style="padding:24px">
        <h2 style="margin:0 0 6px;color:#16262E;font-size:18px">${titre}</h2>
        ${salutation ? `<p style="color:#33454F;font-size:14px;margin:0 0 10px">${salutation}</p>` : ""}
        ${intro ? `<p style="color:#33454F;font-size:14px;line-height:1.6;margin:0 0 6px">${intro}</p>` : ""}
        ${table}
        ${conclusion ? `<p style="color:#5E717B;font-size:13px;line-height:1.6;margin:10px 0 0">${conclusion}</p>` : ""}
      </div>
      <div style="background:#F4F6F7;padding:14px 24px;border-top:1px solid #EEF2F3">
        <p style="color:#9AA7AD;font-size:11px;margin:0">Plateforme de reporting d'activités IT — MUFID UNION · Zone CEMAC · Régulé COBAC</p>
      </div>
    </div>
  </div>`;
}

const texteDepuis = ({ salutation, intro, lignes = [], conclusion }) =>
  [
    salutation,
    intro,
    ...lignes.map((l) => `• ${l.label} : ${l.valeur}`),
    conclusion,
    "\n— Plateforme de reporting d'activités IT, MUFID UNION",
  ]
    .filter(Boolean)
    .join("\n");

// ===========================================================================
// ÉVÉNEMENTS
// ===========================================================================

/** Compte créé : e-mail de bienvenue (avec accès) + notification interne. */
export async function notifierBienvenue({ user, motDePasse, admin }) {
  await creerNotif({
    userId: user.id,
    type: "BIENVENUE",
    titre: "Bienvenue sur la plateforme",
    message:
      `Votre compte a été créé${admin ? ` par ${admin.nom_complet}` : ""}. ` +
      `Vous pouvez saisir et suivre vos activités IT.`,
  });

  const contenu = {
    titre: "Votre compte a été créé",
    salutation: `Bonjour ${user.nom_complet},`,
    intro:
      "Un compte vient de vous être créé sur la plateforme de reporting d'activités IT de MUFID UNION. " +
      "Voici vos informations de connexion :",
    lignes: [
      { label: "E-mail", valeur: user.email },
      { label: "Rôle", valeur: user.role === "ADMIN" ? "Administrateur" : "Employé" },
      ...(user.poste ? [{ label: "Poste", valeur: user.poste }] : []),
      ...(motDePasse ? [{ label: "Mot de passe initial", valeur: motDePasse }] : []),
    ],
    conclusion: motDePasse
      ? "Pour votre sécurité, il est recommandé de faire changer ce mot de passe par l'administrateur après votre première connexion."
      : "Le mot de passe vous a été communiqué par l'administrateur.",
  };
  await envoyerEmail({
    to: user.email,
    subject: "MUFID UNION — Bienvenue, votre compte est prêt",
    text: texteDepuis(contenu),
    html: emailHtml(contenu),
  });
}

/** Compte désactivé : e-mail d'information (pas de notif interne, plus d'accès). */
export async function notifierDesactivationCompte({ user }) {
  const contenu = {
    titre: "Votre compte a été désactivé",
    salutation: `Bonjour ${user.nom_complet},`,
    intro:
      "Votre accès à la plateforme de reporting d'activités IT de MUFID UNION a été désactivé. " +
      "Vos activités restent enregistrées.",
    conclusion: "Pour toute question, contactez l'administrateur système : support@mufidunion.cm.",
  };
  await envoyerEmail({
    to: user.email,
    subject: "MUFID UNION — Désactivation de votre compte",
    text: texteDepuis(contenu),
    html: emailHtml(contenu),
  });
}

/** Tâche affectée par l'admin à un employé : notif interne + e-mail. */
export async function notifierAffectation({ destinataire, admin, activite }) {
  const lignes = [
    { label: "Intitulé", valeur: activite.titre },
    { label: "Catégorie", valeur: libelleCategorie(activite.categorie) },
    { label: "Priorité", valeur: libellePriorite(activite.priorite) },
    { label: "Échéance", valeur: dateFr(activite.date_activite) },
  ];
  await creerNotif({
    userId: destinataire.id,
    type: "AFFECTATION",
    titre: "Nouvelle tâche affectée",
    message: `${admin.nom_complet} vous a affecté « ${activite.titre} » (${libelleCategorie(
      activite.categorie,
    )}, priorité ${libellePriorite(activite.priorite)}) pour le ${dateFr(activite.date_activite)}.`,
    activiteId: activite.id,
  });

  const contenu = {
    titre: "Une nouvelle tâche vous a été affectée",
    salutation: `Bonjour ${destinataire.nom_complet},`,
    intro: `${admin.nom_complet} (${admin.poste || "Administration"}) vous a affecté une nouvelle tâche :`,
    lignes: activite.description ? [...lignes, { label: "Consignes", valeur: activite.description }] : lignes,
    conclusion: "Connectez-vous à la plateforme pour la consulter et suivre son avancement.",
  };
  await envoyerEmail({
    to: destinataire.email,
    subject: "MUFID UNION — Nouvelle tâche vous a été affectée",
    text: texteDepuis(contenu),
    html: emailHtml(contenu),
  });
}

/** Tâche RÉAFFECTÉE : le nouvel agent est prévenu (interne + e-mail). */
export async function notifierReaffectation({ destinataire, ancien, admin, activite, motif }) {
  const lignes = [
    { label: "Intitulé", valeur: activite.titre },
    { label: "Catégorie", valeur: libelleCategorie(activite.categorie) },
    { label: "Priorité", valeur: libellePriorite(activite.priorite) },
    { label: "Échéance", valeur: dateFr(activite.date_activite) },
    { label: "Précédemment affectée à", valeur: ancien ? ancien.nom_complet : "—" },
    ...(motif ? [{ label: "Motif de la réaffectation", valeur: motif }] : []),
  ];
  await creerNotif({
    userId: destinataire.id,
    type: "REAFFECTATION",
    titre: "Tâche réaffectée : elle vous revient",
    message:
      `${admin.nom_complet} vous a réaffecté « ${activite.titre} »` +
      `${ancien ? ` (précédemment confiée à ${ancien.nom_complet})` : ""}` +
      `${motif ? ` — motif : ${motif}` : ""}.`,
    activiteId: activite.id,
  });

  const contenu = {
    titre: "Une tâche vous a été réaffectée",
    salutation: `Bonjour ${destinataire.nom_complet},`,
    intro: `${admin.nom_complet} (${admin.poste || "Administration"}) vous confie une tâche jusque-là suivie par un autre agent :`,
    lignes: activite.consignes ? [...lignes, { label: "Consignes", valeur: activite.consignes }] : lignes,
    conclusion: "Connectez-vous à la plateforme pour la prendre en charge.",
  };
  await envoyerEmail({
    to: destinataire.email,
    subject: "MUFID UNION — Une tâche vous a été réaffectée",
    text: texteDepuis(contenu),
    html: emailHtml(contenu),
  });
}

/** Tâche retirée à un agent (réaffectée à un autre) : notification interne. */
export async function notifierRetraitTache({ destinataire, nouveau, admin, activite, motif }) {
  await creerNotif({
    userId: destinataire.id,
    type: "RETRAIT_TACHE",
    titre: "Une de vos tâches a été réaffectée",
    message:
      `${admin.nom_complet} a réaffecté « ${activite.titre} »` +
      `${nouveau ? ` à ${nouveau.nom_complet}` : ""}` +
      `${motif ? ` — motif : ${motif}` : ""}. Elle ne figure plus dans vos activités.`,
  });
}

/** Un employé a créé une tâche : alerte de tous les admins (interne + e-mail). */
export async function notifierNouvelleTacheEmploye({ auteur, activite }) {
  const admins = await listerAdmins();
  const message = `${auteur.nom_complet} a enregistré une nouvelle activité : « ${activite.titre} » (${libelleStatut(
    activite.statut,
  )}).`;
  await Promise.all(
    admins.map((a) =>
      creerNotif({
        userId: a.id,
        type: "NOUVELLE_TACHE",
        titre: "Nouvelle activité enregistrée",
        message,
        activiteId: activite.id,
      }),
    ),
  );

  const contenu = {
    titre: "Nouvelle activité enregistrée",
    intro: `${auteur.nom_complet} (${auteur.poste || "Employé"}) a enregistré une nouvelle activité :`,
    lignes: [
      { label: "Intitulé", valeur: activite.titre },
      { label: "Catégorie", valeur: libelleCategorie(activite.categorie) },
      { label: "Priorité", valeur: libellePriorite(activite.priorite) },
      { label: "Statut", valeur: libelleStatut(activite.statut) },
      { label: "Date", valeur: dateFr(activite.date_activite) },
    ],
    conclusion: "Consultez la gestion des activités pour le détail.",
  };
  await Promise.all(
    admins.map((a) =>
      envoyerEmail({
        to: a.email,
        subject: `MUFID UNION — Nouvelle activité de ${auteur.nom_complet}`,
        text: texteDepuis({ salutation: `Bonjour ${a.nom_complet},`, ...contenu }),
        html: emailHtml({ salutation: `Bonjour ${a.nom_complet},`, ...contenu }),
      }),
    ),
  );
}

/**
 * Un employé a changé le statut d'une tâche : alerte des admins (interne),
 * e-mail seulement pour les jalons importants (Terminé / Bloqué).
 */
export async function notifierChangementStatut({ auteur, activite, ancienStatut, nouveauStatut }) {
  const admins = await listerAdmins();
  const message = `${auteur.nom_complet} a fait passer « ${activite.titre} » de ${libelleStatut(
    ancienStatut,
  )} à ${libelleStatut(nouveauStatut)}.`;
  await Promise.all(
    admins.map((a) =>
      creerNotif({
        userId: a.id,
        type: "CHANGEMENT_STATUT",
        titre: "Changement de statut",
        message,
        activiteId: activite.id,
      }),
    ),
  );

  // E-mail uniquement pour Terminé / Bloqué (éviter de sur-notifier).
  if (nouveauStatut !== "TERMINE" && nouveauStatut !== "BLOQUE") return;
  const contenu = {
    titre: nouveauStatut === "TERMINE" ? "Une tâche a été terminée" : "Une tâche est bloquée",
    intro: `${auteur.nom_complet} a mis à jour le statut d'une activité :`,
    lignes: [
      { label: "Intitulé", valeur: activite.titre },
      { label: "Ancien statut", valeur: libelleStatut(ancienStatut) },
      { label: "Nouveau statut", valeur: libelleStatut(nouveauStatut) },
      { label: "Catégorie", valeur: libelleCategorie(activite.categorie) },
    ],
    conclusion:
      nouveauStatut === "BLOQUE"
        ? "Cette tâche est signalée comme bloquée : une intervention peut être nécessaire."
        : "Tâche terminée.",
  };
  await Promise.all(
    admins.map((a) =>
      envoyerEmail({
        to: a.email,
        subject: `MUFID UNION — ${contenu.titre} (${auteur.nom_complet})`,
        text: texteDepuis({ salutation: `Bonjour ${a.nom_complet},`, ...contenu }),
        html: emailHtml({ salutation: `Bonjour ${a.nom_complet},`, ...contenu }),
      }),
    ),
  );
}

/** L'admin a modifié la tâche d'un employé : notification interne à l'employé. */
export async function notifierModificationTache({ destinataire, admin, activite }) {
  await creerNotif({
    userId: destinataire.id,
    type: "MODIFICATION_TACHE",
    titre: "Une de vos tâches a été modifiée",
    message: `${admin.nom_complet} a modifié « ${activite.titre} » (statut : ${libelleStatut(
      activite.statut,
    )}, priorité : ${libellePriorite(activite.priorite)}).`,
    activiteId: activite.id,
  });
}

/** L'admin a supprimé la tâche d'un employé : notification interne à l'employé. */
export async function notifierSuppressionTache({ destinataire, admin, activite }) {
  await creerNotif({
    userId: destinataire.id,
    type: "SUPPRESSION_TACHE",
    titre: "Une de vos tâches a été supprimée",
    message: `${admin.nom_complet} a supprimé l'activité « ${activite.titre} ».`,
  });
}
