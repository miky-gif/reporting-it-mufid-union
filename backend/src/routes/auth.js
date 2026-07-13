// Routes d'authentification.
import { Router } from "express";
import { User } from "../models/index.js";
import { creerToken, hacherMotDePasse, verifierMotDePasse } from "../security.js";
import { requireAuth } from "../middleware/auth.js";
import { limiterConnexion } from "../middleware/limiter.js";
import { serialiserUser } from "../utils.js";
import { changeMotDePasseSchema, loginSchema, valider } from "../validators.js";

export const authRouter = Router();

// Anti-force brute : 8 échecs max par IP+e-mail sur 10 minutes.
authRouter.post("/login", limiterConnexion(), async (req, res) => {
  const v = valider(loginSchema, req.body, res);
  if (!v.ok) return;

  const user = await User.findOne({ where: { email: v.data.email } });
  if (!user || !(await verifierMotDePasse(v.data.mot_de_passe, user.mot_de_passe))) {
    return res.status(401).json({ detail: "E-mail ou mot de passe incorrect." });
  }
  if (!user.actif) {
    return res.status(403).json({ detail: "Ce compte est désactivé. Contactez l'administrateur." });
  }
  const token = creerToken(user.id);
  res.json({ access_token: token, token_type: "bearer", user: serialiserUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(serialiserUser(req.user));
});

// POST /auth/mot-de-passe — l'utilisateur change son propre mot de passe.
authRouter.post("/mot-de-passe", requireAuth, async (req, res) => {
  const v = valider(changeMotDePasseSchema, req.body, res);
  if (!v.ok) return;
  const user = await User.findByPk(req.user.id);
  if (!user || !(await verifierMotDePasse(v.data.ancien_mot_de_passe, user.mot_de_passe))) {
    return res.status(400).json({ detail: "Mot de passe actuel incorrect." });
  }
  await user.update({ mot_de_passe: await hacherMotDePasse(v.data.nouveau_mot_de_passe) });
  res.json({ detail: "Mot de passe mis à jour." });
});
