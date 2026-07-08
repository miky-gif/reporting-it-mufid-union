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
  TERMINE: "Terminé",
  BLOQUE: "Bloqué",
};

export const LIBELLES_PRIORITE = {
  BASSE: "Basse",
  MOYENNE: "Moyenne",
  HAUTE: "Haute",
  CRITIQUE: "Critique",
};

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
    reference: referenceActivite(plain.id),
    titre: plain.titre,
    description: plain.description ?? null,
    livrable: plain.livrable ?? null,
    activites_a_mener: plain.activites_a_mener ?? null,
    assignee_par_admin: !!plain.assignee_par_admin,
    categorie: plain.categorie,
    priorite: plain.priorite,
    statut: plain.statut,
    date_activite: plain.date_activite,
    duree_heures: plain.duree_heures,
    date_creation: plain.date_creation,
    date_modification: plain.date_modification,
    user: plain.user
      ? { id: plain.user.id, nom_complet: plain.user.nom_complet, poste: plain.user.poste ?? null }
      : null,
  };
  return out;
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
    date_creation: p.date_creation,
  };
}
