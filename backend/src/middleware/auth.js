// Middlewares d'authentification et de contrôle des rôles.
import { User } from "../models/index.js";
import { decoderToken } from "../security.js";

export async function requireAuth(req, res, next) {
  const entete = req.headers.authorization || "";
  const token = entete.startsWith("Bearer ") ? entete.slice(7) : null;
  const sub = token ? decoderToken(token) : null;
  if (!sub) {
    return res.status(401).json({ detail: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
  const user = await User.findByPk(Number(sub));
  if (!user) {
    return res.status(401).json({ detail: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
  if (!user.actif) {
    return res.status(403).json({ detail: "Ce compte est désactivé. Contactez l'administrateur." });
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ detail: "Accès réservé aux administrateurs." });
  }
  next();
}
