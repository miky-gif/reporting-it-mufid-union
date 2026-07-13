// Limiteur de tentatives en mémoire (anti-force brute sur la connexion).
// Volontairement sans dépendance : suffisant pour un déploiement mono-serveur.
const tentatives = new Map(); // clé -> { n, resetAt }

// Purge périodique des entrées expirées (évite toute fuite mémoire).
setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, e] of tentatives) if (maintenant >= e.resetAt) tentatives.delete(cle);
}, 10 * 60 * 1000).unref();

/**
 * Bloque une IP+e-mail après `max` échecs consécutifs pendant `fenetreMs`.
 * Une connexion réussie remet le compteur à zéro.
 */
export function limiterConnexion({ max = 8, fenetreMs = 10 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const cle = `${req.ip}|${String(req.body?.email || "").toLowerCase()}`;
    const maintenant = Date.now();
    const e = tentatives.get(cle);

    if (e && maintenant < e.resetAt && e.n >= max) {
      const minutes = Math.max(1, Math.ceil((e.resetAt - maintenant) / 60000));
      return res.status(429).json({
        detail: `Trop de tentatives de connexion. Réessayez dans ${minutes} minute(s).`,
      });
    }
    if (!e || maintenant >= e.resetAt) {
      tentatives.set(cle, { n: 0, resetAt: maintenant + fenetreMs });
    }

    // On comptabilise l'issue une fois la réponse envoyée.
    res.on("finish", () => {
      const courant = tentatives.get(cle);
      if (!courant) return;
      if (res.statusCode === 200) tentatives.delete(cle); // succès -> reset
      else if (res.statusCode === 401) courant.n += 1; // identifiants invalides
    });

    next();
  };
}
