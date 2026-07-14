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
/** « Administration » = ADMIN ou SUPER_ADMIN (le super admin a tous les droits). */
export const estAdministration = (user) => user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

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

/** Liste des droits d'un utilisateur (MariaDB renvoie le JSON en chaîne). */
export function permissionsDe(user) {
  if (!user) return [];
  if (estSuperAdmin(user)) return Object.keys(PERMISSIONS); // tout, implicitement
  if (user.role !== "ADMIN") return [];
  const p = user.permissions;
  if (!p) return [];
  if (Array.isArray(p)) return p;
  try {
    const parse = JSON.parse(p);
    return Array.isArray(parse) ? parse : [];
  } catch {
    return [];
  }
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
 * Département auquel l'utilisateur est limité, ou null s'il voit tout
 * (super admin). Sert à filtrer listes, statistiques et rapports.
 */
export function perimetreDepartement(user) {
  if (estSuperAdmin(user)) return null; // aucun cloisonnement
  return user?.departement_id ?? -1; // -1 : aucun département -> ne voit rien
}

/** Vrai si l'utilisateur a le droit d'agir sur ce département. */
export function accedeDepartement(user, departementId) {
  if (estSuperAdmin(user)) return true;
  return departementId != null && user?.departement_id === departementId;
}
