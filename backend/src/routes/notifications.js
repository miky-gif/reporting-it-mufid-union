// Routes des notifications de l'utilisateur connecté.
import { Router } from "express";
import { Notification } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /notifications — liste + nombre de non lues
notificationsRouter.get("/", async (req, res) => {
  const items = await Notification.findAll({
    where: { user_id: req.user.id },
    order: [["date_creation", "DESC"]],
    limit: 30,
  });
  const nonLues = await Notification.count({ where: { user_id: req.user.id, lu: false } });
  res.json({ items, non_lues: nonLues });
});

// POST /notifications/:id/lu — marque une notification comme lue
notificationsRouter.post("/:id/lu", async (req, res) => {
  const notif = await Notification.findByPk(Number(req.params.id));
  if (!notif || notif.user_id !== req.user.id) {
    return res.status(404).json({ detail: "Notification introuvable." });
  }
  await notif.update({ lu: true });
  res.json({ ok: true });
});

// POST /notifications/lire-tout — marque toutes les notifications comme lues
notificationsRouter.post("/lire-tout", async (req, res) => {
  await Notification.update({ lu: true }, { where: { user_id: req.user.id, lu: false } });
  res.json({ ok: true });
});
