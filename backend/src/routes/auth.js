// Routes d'authentification.
import { Router } from "express";
import { User } from "../models/index.js";
import { creerToken, verifierMotDePasse } from "../security.js";
import { requireAuth } from "../middleware/auth.js";
import { serialiserUser } from "../utils.js";
import { loginSchema, valider } from "../validators.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
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
