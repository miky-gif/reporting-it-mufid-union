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

// Points : 40 h = 5 points -> 1 point = 480 minutes.
export const MINUTES_PAR_POINT = 480;
export const pointsDepuisMinutes = (min) => Math.round(((min || 0) / MINUTES_PAR_POINT) * 1000) / 1000;

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
    points: pointsDepuisMinutes(plain.duree_minutes ?? (plain.duree_heures || 0) * 60),
    points_acquis:
      plain.statut === "CLOTURE"
        ? pointsDepuisMinutes(plain.duree_minutes ?? (plain.duree_heures || 0) * 60)
        : 0,
    en_retard: estEnRetard(plain.date_activite, plain.statut),
    date_cloture: plain.date_cloture ?? null,
    cloture_par: plain.cloture_par ?? null,
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
