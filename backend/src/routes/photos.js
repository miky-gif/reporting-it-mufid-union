// Photo de profil d'un utilisateur.
//
// Un utilisateur gère SA propre photo ; tout compte connecté peut lire celle
// des autres, car les avatars s'affichent dans les listes et les tableaux.
//
// Ce routeur est volontairement séparé de /users, dont l'accès est réservé aux
// administrateurs : un employé doit pouvoir changer sa photo.
import { Router } from "express";
import { User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { serialiserUser } from "../utils.js";
import { cheminPhoto, supprimerPhoto, uploadPhoto } from "../services/uploads.js";

export const photosRouter = Router();

photosRouter.use(requireAuth);

/**
 * GET /photos/:id — image de profil d'un utilisateur.
 *
 * L'URL porte une empreinte du fichier (`?v=`), qui change à chaque envoi :
 * on peut donc demander au navigateur de la garder longtemps en cache sans
 * risquer d'afficher une photo périmée.
 */
photosRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ detail: "Identifiant invalide." });
  }
  const user = await User.findByPk(id, { attributes: ["id", "photo"] });
  if (!user || !user.photo) return res.status(404).json({ detail: "Aucune photo." });

  const chemin = cheminPhoto(user.photo);
  if (!chemin) return res.status(404).json({ detail: "Photo introuvable sur le disque." });

  res.setHeader("Cache-Control", "private, max-age=86400, immutable");
  res.sendFile(chemin, (err) => {
    if (err && !res.headersSent) res.status(404).json({ detail: "Photo illisible." });
  });
});

/**
 * POST /photos — l'utilisateur remplace sa propre photo.
 * Champ attendu : `photo` (multipart/form-data).
 */
photosRouter.post("/", (req, res) => {
  uploadPhoto.single("photo")(req, res, async (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image trop lourde (4 Mo maximum)."
          : err.message || "Envoi impossible.";
      return res.status(400).json({ detail: message });
    }
    if (!req.file) return res.status(400).json({ detail: "Aucune image reçue." });

    const user = await User.findByPk(req.user.id);
    if (!user) {
      supprimerPhoto(req.file.filename);
      return res.status(404).json({ detail: "Compte introuvable." });
    }

    // L'ancienne photo ne sert plus : on la retire pour ne pas accumuler.
    const ancienne = user.photo;
    await user.update({ photo: req.file.filename });
    if (ancienne && ancienne !== req.file.filename) supprimerPhoto(ancienne);

    const complet = await User.findByPk(user.id, { include: "departement" });
    res.status(201).json(serialiserUser(complet));
  });
});

/** DELETE /photos — l'utilisateur retire sa photo et retrouve ses initiales. */
photosRouter.delete("/", async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ detail: "Compte introuvable." });
  if (user.photo) {
    const ancienne = user.photo;
    await user.update({ photo: null });
    supprimerPhoto(ancienne);
  }
  const complet = await User.findByPk(user.id, { include: "departement" });
  res.json(serialiserUser(complet));
});
