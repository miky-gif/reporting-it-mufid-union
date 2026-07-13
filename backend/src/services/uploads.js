// Configuration des téléversements (pièces jointes) via multer.
// Stockage sur disque dans backend/uploads/, hors racine web publique.
import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

// Résolu depuis ce fichier (backend/src/services) -> backend/uploads,
// indépendamment du répertoire de lancement (PM2, service Windows…).
const ICI = path.dirname(fileURLToPath(import.meta.url));
export const DOSSIER_UPLOADS = path.resolve(ICI, "../../uploads");
if (!existsSync(DOSSIER_UPLOADS)) mkdirSync(DOSSIER_UPLOADS, { recursive: true });

// Types de fichiers autorisés (rapports, tableurs, images).
const MIMES_AUTORISES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOSSIER_UPLOADS),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo par fichier
  fileFilter: (_req, file, cb) => {
    if (MIMES_AUTORISES.has(file.mimetype)) return cb(null, true);
    cb(new Error("Type de fichier non autorisé (PDF, Word, Excel, image ou texte)."));
  },
});
