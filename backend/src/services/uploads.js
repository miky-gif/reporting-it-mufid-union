// Configuration des téléversements (pièces jointes) via multer.
// Stockage sur disque : par défaut backend/uploads/, ou un dossier configuré
// (UPLOADS_DIR) — typiquement un partage NAS de l'entreprise.
//
// Les fichiers sont rangés dans un SOUS-DOSSIER par rubrique (configuré par
// l'administrateur sur la catégorie), en conservant leur nom d'origine.
import { randomUUID } from "crypto";
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { config } from "../config.js";

// Résolu depuis ce fichier (backend/src/services) -> backend/uploads par défaut,
// indépendamment du répertoire de lancement (PM2, service Windows…).
const ICI = path.dirname(fileURLToPath(import.meta.url));

// Dossier LOCAL : toujours disponible, sert de repli si le NAS tombe.
export const DOSSIER_LOCAL = path.resolve(ICI, "../../uploads");

// UPLOADS_DIR : chemin absolu (UNC « \\NAS\partage\dossier » ou « /mnt/… ») pris
// tel quel ; un chemin relatif est résolu depuis la racine backend.
// C'est la RACINE du stockage : les dossiers de rubriques sont créés dedans.
export const DOSSIER_UPLOADS = config.uploadsDir
  ? path.resolve(ICI, "../..", config.uploadsDir)
  : DOSSIER_LOCAL;

/** Vrai si un stockage distant (NAS) est configuré, distinct du dossier local. */
export const stockageDistant = DOSSIER_UPLOADS !== DOSSIER_LOCAL;

// Le dossier local doit toujours exister : c'est le filet de sécurité.
try {
  if (!existsSync(DOSSIER_LOCAL)) mkdirSync(DOSSIER_LOCAL, { recursive: true });
} catch (e) {
  console.error(`✖ Dossier local des pièces jointes inaccessible : ${e.message}`);
}

/* ------------------------------------------------------------------ */
/* Disponibilité du NAS (avec repli automatique sur le dossier local)  */
/* Le partage peut tomber en cours d'exploitation : on vérifie avant   */
/* chaque écriture, avec un cache court pour ne pas ralentir l'appli.  */
/* ------------------------------------------------------------------ */
const DUREE_CACHE_MS = 30_000; // on ne re-teste le NAS qu'une fois par 30 s
let cacheDispo = { valeur: null, expire: 0 };
let dernierEtatSignale = null;

/** Teste (et met en cache) la disponibilité en écriture du stockage distant. */
function nasDisponible() {
  if (!stockageDistant) return false;
  const maintenant = Date.now();
  if (cacheDispo.valeur !== null && maintenant < cacheDispo.expire) return cacheDispo.valeur;

  let dispo = false;
  try {
    if (!existsSync(DOSSIER_UPLOADS)) mkdirSync(DOSSIER_UPLOADS, { recursive: true });
    accessSync(DOSSIER_UPLOADS, constants.W_OK); // accessible en écriture ?
    dispo = true;
  } catch {
    dispo = false;
  }
  cacheDispo = { valeur: dispo, expire: maintenant + DUREE_CACHE_MS };

  // On ne journalise que les CHANGEMENTS d'état (pas à chaque appel).
  if (dispo !== dernierEtatSignale) {
    dernierEtatSignale = dispo;
    if (dispo) {
      console.log(`📎 Stockage NAS disponible : ${DOSSIER_UPLOADS}`);
    } else {
      console.warn(
        `⚠ NAS indisponible (${DOSSIER_UPLOADS}). ` +
          `Repli sur le dossier local : ${DOSSIER_LOCAL}. Les fichiers déjà sur le NAS restent lisibles.`,
      );
    }
  }
  return dispo;
}

/** Racine de stockage à utiliser MAINTENANT (NAS si joignable, sinon local). */
export function racineActive() {
  return nasDisponible() ? DOSSIER_UPLOADS : DOSSIER_LOCAL;
}

/** Les deux racines possibles, dans l'ordre de recherche d'un fichier. */
const racines = () => (stockageDistant ? [DOSSIER_UPLOADS, DOSSIER_LOCAL] : [DOSSIER_LOCAL]);

/**
 * Chemin ABSOLU d'un fichier enregistré (chemin relatif en base).
 * On cherche sur le NAS puis en local : un fichier déposé pendant une panne
 * reste accessible une fois le NAS revenu, et inversement.
 * Renvoie null si le fichier est introuvable des deux côtés.
 */
export function cheminFichier(relatif) {
  const rel = String(relatif || "").replace(/\\/g, "/");
  for (const racine of racines()) {
    const absolu = path.resolve(racine, rel);
    // Garde-fou : le chemin doit rester sous la racine.
    if (absolu !== racine && !absolu.startsWith(racine + path.sep)) continue;
    try {
      if (existsSync(absolu)) return absolu;
    } catch {
      /* racine injoignable : on tente la suivante */
    }
  }
  return null;
}

console.log(
  stockageDistant
    ? `📎 Pièces jointes : NAS « ${DOSSIER_UPLOADS} » (repli local « ${DOSSIER_LOCAL} »)`
    : `📎 Pièces jointes stockées dans : ${DOSSIER_LOCAL}`,
);

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

// Les fichiers arrivent d'abord dans un dossier temporaire, sur la MÊME racine
// que la destination finale (déplacement instantané). Le dossier final dépend
// de la rubrique de l'activité, connue seulement dans la route.
export function dossierTemporaire() {
  const tmp = path.join(racineActive(), ".tmp");
  mkdirSync(tmp, { recursive: true });
  return tmp;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, dossierTemporaire());
    } catch (e) {
      cb(e);
    }
  },
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

/* ------------------------------------------------------------------ */
/* Rangement par rubrique                                              */
/* Chaque rubrique d'une catégorie peut viser un dossier du NAS.       */
/* Tout reste contenu dans DOSSIER_UPLOADS : aucune écriture au-dessus.*/
/* ------------------------------------------------------------------ */

// Caractères interdits par Windows/NAS dans un nom de dossier ou de fichier.
// Les espaces, tirets et accents restent autorisés (« Exploitation Système »).
const CARACTERES_INTERDITS = /["*:<>?|]/g;

/** Nettoie un segment de chemin (un niveau de dossier). */
function nettoyerSegment(segment) {
  return String(segment)
    .replace(CARACTERES_INTERDITS, "")
    .replace(/^\.+$/, "") // « . » et « .. » neutralisés
    .trim()
    .replace(/[\s.]+$/, "") // Windows n'accepte ni espace ni point final
    .slice(0, 80)
    .trim();
}

/**
 * Normalise un chemin de dossier saisi par l'administrateur
 * (« Infrastructure/Sauvegardes », « \Infra\Sauv », « ../secret » …).
 * Renvoie un chemin relatif sûr, ou "" si rien d'exploitable.
 */
export function normaliserDossier(chemin) {
  return String(chemin || "")
    .replace(/\\/g, "/")
    .split("/")
    .map(nettoyerSegment)
    .filter(Boolean)
    .slice(0, 6) // profondeur raisonnable
    .join("/");
}

/** Nom de dossier déduit d'un libellé (repli quand rien n'est configuré). */
export const dossierDepuisLibelle = (libelle) => nettoyerSegment(libelle) || "Divers";

/**
 * Chemin absolu du dossier de rangement, garanti à l'intérieur de la racine
 * de stockage active. Renvoie null si le chemin tente d'en sortir.
 */
export function dossierAbsolu(dossierRelatif, racineChoisie = null) {
  const relatif = normaliserDossier(dossierRelatif);
  const racine = path.resolve(racineChoisie || racineActive());
  const absolu = path.resolve(racine, relatif);
  if (absolu !== racine && !absolu.startsWith(racine + path.sep)) return null; // hors périmètre
  return absolu;
}

/** Nom de fichier sûr, en conservant le nom d'origine (accents compris). */
export function nettoyerNomFichier(nom) {
  const base = path
    .basename(String(nom || "fichier").replace(/\\/g, "/"))
    .replace(CARACTERES_INTERDITS, "")
    .trim();
  return base.replace(/^\.+/, "").slice(0, 180).trim() || "fichier";
}

/**
 * Range un fichier téléversé (encore dans le dossier temporaire) dans le
 * dossier de la rubrique, en conservant son nom d'origine. En cas de
 * doublon, un suffixe « (2) », « (3) »… est ajouté (aucun écrasement).
 * Renvoie le chemin RELATIF à enregistrer en base.
 */
export function rangerFichier(cheminTemporaire, dossierRelatif, nomOrigine) {
  const relatif = normaliserDossier(dossierRelatif);
  // NAS si disponible, sinon dossier local (repli transparent).
  const racine = racineActive();
  const dossier = dossierAbsolu(relatif, racine);
  if (!dossier) throw new Error("Dossier de destination invalide.");
  mkdirSync(dossier, { recursive: true });

  const nom = nettoyerNomFichier(nomOrigine);
  const ext = path.extname(nom);
  const socle = path.basename(nom, ext);
  let final = nom;
  let n = 2;
  while (existsSync(path.join(dossier, final))) {
    final = `${socle} (${n})${ext}`;
    n += 1;
  }

  const destination = path.join(dossier, final);
  try {
    renameSync(cheminTemporaire, destination);
  } catch (e) {
    // Volumes différents (EXDEV) : on copie puis on supprime la source.
    if (e.code !== "EXDEV") throw e;
    copyFileSync(cheminTemporaire, destination);
    unlinkSync(cheminTemporaire);
  }
  // Chemin relatif portable (séparateur « / » en base).
  return relatif ? `${relatif}/${final}` : final;
}
