// Client HTTP axios : base URL, injection du token JWT, gestion 401.
import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL });

const CLE_TOKEN = "mufid_token";

export function getToken(): string | null {
  return localStorage.getItem(CLE_TOKEN);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(CLE_TOKEN, token);
  else localStorage.removeItem(CLE_TOKEN);
}

// Ajoute le jeton à chaque requête.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Déconnexion automatique sur 401 (hors page de login).
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401 && !location.pathname.includes("/login")) {
      setToken(null);
      location.href = "/login";
    }
    return Promise.reject(error);
  },
);

/** Extrait un message d'erreur lisible depuis une réponse FastAPI. */
export function messageErreur(error: unknown, defaut = "Une erreur est survenue."): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  }
  return defaut;
}
