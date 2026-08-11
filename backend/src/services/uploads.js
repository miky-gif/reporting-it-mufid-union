// Configuration des téléversements (pièces jointes) via multer.
// Stockage sur disque : par défaut backend/uploads/, ou un dossier configuré
// (UPLOADS_DIR) — typiquement un partage NAS de l'entreprise.
import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { config } from "../config.js";

// Résolu depuis ce fichier (backend/src/services) -> backend/uploads par défaut,
// indépendamment du répertoire de lancement (PM2, service Windows…).
const ICI = path.dirname(fileURLToPath(import.meta.url));
const DEFAUT = path.resolve(ICI, "../../uploads");
// UPLOADS_DIR : chemin absolu (UNC « \\NAS\partage\dossier » ou « Z:\dossier ») pris
// tel quel ; un chemin relatif est résolu depuis la racine backend.
export const DOSSIER_UPLOADS = config.uploadsDir
  ? path.resolve(ICI, "../..", config.uploadsDir)
  : DEFAUT;

// Création du dossier (récursive). En cas d'échec (NAS injoignable au démarrage),
// on ne bloque pas le serveur : les autres fonctions restent opérationnelles,
// seuls les envois/téléchargements de pièces jointes échoueront tant que le
// partage n'est pas accessible.
try {
  if (!existsSync(DOSSIER_UPLOADS)) mkdirSync(DOSSIER_UPLOADS, { recursive: true });
  console.log(`📎 Pièces jointes stockées dans : ${DOSSIER_UPLOADS}`);
} catch (e) {
  console.error(
    `✖ Dossier des pièces jointes inaccessible (${DOSSIER_UPLOADS}) : ${e.message}. ` +
      "Vérifiez que le partage NAS est monté et accessible en écriture par le compte du service.",
  );
}

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
