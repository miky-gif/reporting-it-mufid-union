// Configuration centralisée, lue depuis le fichier .env.
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8000),
  databaseUrl: process.env.DATABASE_URL || "mysql://root:root@localhost:3306/mufid_activites",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-a-changer",
  accessTokenExpireMinutes: Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 480),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  seedPassword: process.env.SEED_PASSWORD || "Mufid2026!",
};
