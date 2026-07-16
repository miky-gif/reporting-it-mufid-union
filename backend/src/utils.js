// Fonctions utilitaires : libellés français, références, initiales, slug ASCII.

export const LIBELLES_CATEGORIE = {
  DEVELOPPEMENT: "Développement",
  CYBERSECURITE: "Cybersécurité",
  INFRASTRUCTURE: "Infrastructure/Réseau",
  SUPPORT: "Support",
  MAINTENANCE: "Maintenance",
  REPORTING: "Reporting",
  AUTRE: "Autre",
};

export const LIBELLES_STATUT = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  STANDBY: "Standby",
  TERMINE: "Terminé",
  CLOTURE: "Clôturé",
  BLOQUE: "Standby", // rétro-compatibilité (ancien libellé)
};

export const LIBELLES_PRIORITE = {
  BASSE: "Basse",
  MOYENNE: "Moyenne",
  HAUTE: "Haute",
  TRES_HAUTE: "Très haute",
  CRITIQUE: "Critique",
};

// % de réalisation par défaut, déduit du statut (utilisé si non saisi).
export const POURCENTAGE_PAR_STATUT = {
  A_FAIRE: 0,
  EN_COURS: 50,
  STANDBY: 25,
  TERMINE: 100,
  CLOTURE: 100,
};
// Pourcentage effectif : la valeur saisie prime, sinon on déduit du statut.
export function pourcentageEffectif(pourcentage, statut) {
  if (pourcentage !== null && pourcentage !== undefined && pourcentage !== "") {
    return Math.max(0, Math.min(100, Number(pourcentage)));
  }
  return POURCENTAGE_PAR_STATUT[statut] ?? 0;
}

/**
 * Libellé d'en-tête d'un département, avec l'élision correcte :
 *   « Infrastructure »        -> « Département d'Infrastructure »
 *   « Exploitation Système »  -> « Département d'Exploitation Système »
 *   « Cybersécurité »         -> « Département de Cybersécurité »
 * Si le nom contient déjà « Département », il est repris tel quel.
 */
export function libelleDepartement(nom) {
  const n = (nom || "").trim();
  if (!n) return "Direction des Systèmes d'Information";
  if (/^d[ée]partement/i.test(n)) return n;
  const premiere = n[0].toLowerCase();
  const voyelle = "aeiouyàâäéèêëîïôöùûü".includes(premiere);
  return `Département ${voyelle ? "d'" : "de "}${n}`;
}

// Libellés des fréquences de récurrence.
export const LIBELLES_RECURRENCE = {
  AUCUNE: "Aucune",
  JOUR: "Quotidienne",
  SEMAINE: "Hebdomadaire",
  MOIS: "Mensuelle",
};
export const libelleRecurrence = (r) => LIBELLES_RECURRENCE[r] ?? r;

// Ajoute `n` intervalles de récurrence à une date ISO (AAAA-MM-JJ).
// MOIS : conserve le jour du mois en le bornant à la fin du mois (31 janv -> 28 fév).
export function ajouterIntervalle(iso, frequence, n = 1) {
  const [a, m, j] = String(iso).split("-").map(Number);
  if (frequence === "JOUR") {
    const d = new Date(Date.UTC(a, m - 1, j + n));
    return d.toISOString().slice(0, 10);
  }
  if (frequence === "SEMAINE") {
    const d = new Date(Date.UTC(a, m - 1, j + 7 * n));
    return d.toISOString().slice(0, 10);
  }
  if (frequence === "MOIS") {
    const total = (m - 1) + n;
    const annee = a + Math.floor(total / 12);
    const mois = ((total % 12) + 12) % 12;
    const dernierJour = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
    const jour = Math.min(j, dernierJour);
    return new Date(Date.UTC(annee, mois, jour)).toISOString().slice(0, 10);
  }
  return iso;
}

// Points : 40 h = 5 points -> 1 point = 480 minutes.
export const MINUTES_PAR_POINT = 480;
export const pointsDepuisMinutes = (min) => Math.round(((min || 0) / MINUTES_PAR_POINT) * 1000) / 1000;

// Minutes d'une activité (source de vérité : duree_minutes, repli sur les heures).
export const minutesActivite = (a) => a.duree_minutes || Math.round((a.duree_heures || 0) * 60);
// Points AUTOMATIQUES calculés sur la durée.
export const pointsBase = (a) => pointsDepuisMinutes(minutesActivite(a));
// Points EFFECTIFS = automatiques + ajustement manuel de l'admin, borné à 0.
export function pointsEffectifs(a) {
  const total = pointsBase(a) + Number(a.points_ajustement || 0);
  return Math.max(0, Math.round(total * 1000) / 1000);
}

// Une tâche est en retard si l'échéance est passée et qu'elle n'est ni terminée ni clôturée.
export function estEnRetard(dateActivite, statut) {
  if (statut === "TERMINE" || statut === "CLOTURE") return false;
  const auj = new Date().toISOString().slice(0, 10);
  return String(dateActivite) < auj;
}

export const libelleCategorie = (c) => LIBELLES_CATEGORIE[c] ?? c;
export const libelleStatut = (s) => LIBELLES_STATUT[s] ?? s;
export const libellePriorite = (p) => LIBELLES_PRIORITE[p] ?? p;

// Référence lisible et stable dérivée de l'identifiant (ex. « ACT-2001 »).
export const referenceActivite = (id) => `ACT-${2000 + id}`;

export function initiales(nomComplet) {
  const parties = (nomComplet || "").split(/\s+/).filter(Boolean);
  if (parties.length === 0) return "?";
  if (parties.length === 1) return parties[0].slice(0, 2).toUpperCase();
  return (parties[0][0] + parties[parties.length - 1][0]).toUpperCase();
}

// Normalise une chaîne en ASCII sûr pour un nom de fichier (en-tête HTTP).
export function slugAscii(texte) {
  const sansAccents = (texte || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  return sansAccents.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "fichier";
}

// Sérialise une activité (ajoute la référence + résumé de l'auteur).
export function serialiserActivite(a) {
  const plain = a.get ? a.get({ plain: true }) : a;
  const out = {
    id: plain.id,
    user_id: plain.user_id,
    departement_id: plain.departement_id ?? null,
    reference: referenceActivite(plain.id),
    titre: plain.titre,
    description: plain.description ?? null, // état d'exécution
    consignes: plain.consignes ?? null,
    livrable: plain.livrable ?? null,
    activites_a_mener: plain.activites_a_mener ?? null,
    assignee_par_admin: !!plain.assignee_par_admin,
    groupe_affectation_id: plain.groupe_affectation_id ?? null,
    categorie: plain.categorie,
    priorite: plain.priorite,
    statut: plain.statut,
    pourcentage: pourcentageEffectif(plain.pourcentage, plain.statut),
    date_activite: plain.date_activite,
    date_debut: plain.date_debut ?? plain.date_activite,
    date_fin: plain.date_fin ?? plain.date_activite,
    duree_minutes: plain.duree_minutes ?? Math.round((plain.duree_heures || 0) * 60),
    duree_heures: plain.duree_heures,
    points_base: pointsBase(plain), // calcul automatique (durée)
    points_ajustement: Number(plain.points_ajustement || 0), // bonus/malus admin
    points: pointsEffectifs(plain), // total effectif (base + ajustement)
    points_acquis: plain.statut === "CLOTURE" ? pointsEffectifs(plain) : 0,
    en_retard: estEnRetard(plain.date_activite, plain.statut),
    date_cloture: plain.date_cloture ?? null,
    cloture_par: plain.cloture_par ?? null,
    reaffectee: !!plain.reaffectee_de,
    reaffectee_de: plain.reaffectee_de ?? null,
    date_reaffectation: plain.date_reaffectation ?? null,
    motif_reaffectation: plain.motif_reaffectation ?? null,
    recurrence: plain.recurrence ?? "AUCUNE",
    recurrence_fin: plain.recurrence_fin ?? null,
    recurrence_prochaine: plain.recurrence_prochaine ?? null,
    recurrence_active: plain.recurrence_active === undefined ? true : !!plain.recurrence_active,
    recurrence_parent_id: plain.recurrence_parent_id ?? null,
    date_creation: plain.date_creation,
    date_modification: plain.date_modification,
    user: plain.user
      ? { id: plain.user.id, nom_complet: plain.user.nom_complet, poste: plain.user.poste ?? null }
      : null,
    pieces: Array.isArray(plain.pieces)
      ? plain.pieces.map((p) => ({
          id: p.id,
          nom_fichier: p.nom_fichier,
          mime: p.mime,
          taille: p.taille,
          date_creation: p.date_creation,
        }))
      : undefined,
  };
  return out;
}

// Liste de droits d'un utilisateur (MariaDB renvoie le JSON en chaîne).
export function parsePermissions(valeur) {
  if (!valeur) return [];
  if (Array.isArray(valeur)) return valeur;
  try {
    const p = JSON.parse(valeur);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

// Formate un objet User pour les réponses (sans le mot de passe).
export function serialiserUser(u) {
  const p = u.get ? u.get({ plain: true }) : u;
  return {
    id: p.id,
    nom_complet: p.nom_complet,
    email: p.email,
    poste: p.poste ?? null,
    role: p.role,
    actif: !!p.actif,
    departement_id: p.departement_id ?? null,
    departement: p.departement
      ? { id: p.departement.id, code: p.departement.code, nom: p.departement.nom, couleur: p.departement.couleur }
      : null,
    permissions: p.role === "ADMIN" ? parsePermissions(p.permissions) : [],
    date_creation: p.date_creation,
  };
}

// Formate un département (le mot de passe SMTP n'est jamais exposé).
export function serialiserDepartement(d) {
  const p = d.get ? d.get({ plain: true }) : d;
  return {
    id: p.id,
    code: p.code,
    nom: p.nom,
    description: p.description ?? null,
    couleur: p.couleur,
    actif: !!p.actif,
    smtp_host: p.smtp_host ?? null,
    smtp_port: p.smtp_port ?? null,
    smtp_user: p.smtp_user ?? null,
    smtp_tls_insecure: !!p.smtp_tls_insecure,
    mail_from: p.mail_from ?? null,
    // On n'expose jamais le mot de passe : seulement s'il est renseigné.
    smtp_configure: Boolean(p.smtp_host && p.smtp_pass),
    date_creation: p.date_creation,
  };
}
