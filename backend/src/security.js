// Hachage des mots de passe (bcrypt) et jetons JWT.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export async function hacherMotDePasse(motDePasse) {
  return bcrypt.hash(motDePasse, 10);
}

export async function verifierMotDePasse(clair, hache) {
  return bcrypt.compare(clair, hache);
}

export function creerToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, {
    expiresIn: `${config.accessTokenExpireMinutes}m`,
  });
}

export function decoderToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return payload.sub;
  } catch {
    return null;
  }
}
