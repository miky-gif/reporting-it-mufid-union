// Middlewares d'authentification, de rôles et de permissions granulaires.
import { Departement, PERMISSIONS, User } from "../models/index.js";
import { decoderToken } from "../security.js";

export async function requireAuth(req, res, next) {
  const entete = req.headers.authorization || "";
  const token = entete.startsWith("Bearer ") ? entete.slice(7) : null;
  const sub = token ? decoderToken(token) : null;
  if (!sub) {
    return res.status(401).json({ detail: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
  // Le département est chargé : il sert au cloisonnement et à l'affichage (/auth/me).
  const user = await User.findByPk(Number(sub), {
    include: { model: Departement, as: "departement" },
  });
  if (!user) {
    return res.status(401).json({ detail: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
  if (!user.actif) {
    return res.status(403).json({ detail: "Ce compte est désactivé. Contactez l'administrateur." });
  }
  req.user = user;
  next();
}

/* ------------------------------------------------------------------ */
/* Rôles                                                               */
/* ------------------------------------------------------------------ */

export const estSuperAdmin = (user) => user?.role === "SUPER_ADMIN";
/** Superviseur : administrateur d'un périmètre de plusieurs départements. */
export const estSuperviseur = (user) => user?.role === "SUPERVISEUR";
/** « Administration » = ADMIN, SUPERVISEUR ou SUPER_ADMIN (le super admin a tous les droits). */
export const estAdministration = (user) =>
  user?.role === "ADMIN" || user?.role === "SUPERVISEUR" || user?.role === "SUPER_ADMIN";

/** Réservé à l'administration (admin de département ou super admin). */
export function requireAdmin(req, res, next) {
  if (!estAdministration(req.user)) {
    return res.status(403).json({ detail: "Accès réservé aux administrateurs." });
  }
  next();
}

/** Réservé au super administrateur (départements, création d'admins, SMTP…). */
export function requireSuperAdmin(req, res, next) {
  if (!estSuperAdmin(req.user)) {
    return res.status(403).json({ detail: "Accès réservé au super administrateur." });
  }
  next();
}

/* ------------------------------------------------------------------ */
/* Permissions granulaires                                             */
/* ------------------------------------------------------------------ */

/** Parse une colonne JSON tableau (MariaDB peut la renvoyer en chaîne). */
function parseTableau(valeur) {
  if (!valeur) return [];
  if (Array.isArray(valeur)) return valeur;
  try {
    const p = JSON.parse(valeur);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Liste des droits d'un utilisateur (MariaDB renvoie le JSON en chaîne). */
export function permissionsDe(user) {
  if (!user) return [];
  if (estSuperAdmin(user)) return Object.keys(PERMISSIONS); // tout, implicitement
  // ADMIN et SUPERVISEUR disposent de droits granulaires.
  if (user.role !== "ADMIN" && user.role !== "SUPERVISEUR") return [];
  return parseTableau(user.permissions);
}

/** Vrai si l'utilisateur détient le droit demandé. */
export function peut(user, code) {
  if (estSuperAdmin(user)) return true;
  return permissionsDe(user).includes(code);
}

/**
 * Exige un droit précis. Le super admin passe toujours ;
 * un admin doit l'avoir reçu ; un IT est refusé.
 */
export function requirePermission(code) {
  return (req, res, next) => {
    if (!estAdministration(req.user)) {
      return res.status(403).json({ detail: "Accès réservé aux administrateurs." });
    }
    if (!peut(req.user, code)) {
      return res.status(403).json({
        detail: `Droit manquant : « ${PERMISSIONS[code] ?? code} ». Contactez le super administrateur.`,
      });
    }
    next();
  };
}

/* ------------------------------------------------------------------ */
/* Cloisonnement par département                                       */
/* ------------------------------------------------------------------ */

/**
 * Ensemble des départements administrés par l'utilisateur :
 *   - SUPER_ADMIN            -> null (aucun cloisonnement, voit tout) ;
 *   - SUPERVISEUR            -> sa liste departements_geres ;
 *   - ADMIN / EMPLOYE        -> son unique département.
 * Renvoie toujours null (tout) ou un tableau d'identifiants.
 */
export function departementsGeres(user) {
  if (estSuperAdmin(user)) return null; // aucun cloisonnement
  if (estSuperviseur(user)) {
    const ids = parseTableau(user?.departements_geres).map(Number).filter((n) => n > 0);
    if (ids.length > 0) return ids;
    // Repli : au moins son département principal, sinon rien.
    return user?.departement_id != null ? [user.departement_id] : [];
  }
  return user?.departement_id != null ? [user.departement_id] : [];
}

/**
 * Périmètre à injecter dans un `where` Sequelize (clause IN si tableau).
 * null = aucun filtre (super admin) ; [-1] = ne voit rien (aucun département).
 */
export function perimetreDepartement(user) {
  const g = departementsGeres(user);
  if (g === null) return null; // aucun cloisonnement
  return g.length > 0 ? g : [-1]; // -1 : aucun département -> ne voit rien
}

/** Vrai si l'utilisateur a le droit d'agir sur ce département. */
export function accedeDepartement(user, departementId) {
  if (estSuperAdmin(user)) return true;
  if (departementId == null) return false;
  return departementsGeres(user).includes(Number(departementId));
}
