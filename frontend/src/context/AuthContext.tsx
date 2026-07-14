import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "@/lib/api";
import type { Permission, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  chargement: boolean;
  connexion: (email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => void;
  /** Administration : admin de département OU super admin. */
  estAdmin: boolean;
  /** Super administrateur : voit tout, gère les départements et les admins. */
  estSuperAdmin: boolean;
  /** Vrai si l'utilisateur détient ce droit (le super admin les a tous). */
  peut: (droit: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [chargement, setChargement] = useState(true);

  // Restaure la session si un token est présent.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChargement(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setToken(null))
      .finally(() => setChargement(false));
  }, []);

  const connexion = useCallback(async (email: string, motDePasse: string) => {
    const { data } = await api.post("/auth/login", { email, mot_de_passe: motDePasse });
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const deconnexion = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const estSuperAdmin = user?.role === "SUPER_ADMIN";
    const estAdmin = estSuperAdmin || user?.role === "ADMIN";
    // Le super admin détient implicitement tous les droits.
    const peut = (droit: Permission) =>
      estSuperAdmin || (user?.permissions ?? []).includes(droit);
    return { user, chargement, connexion, deconnexion, estAdmin, estSuperAdmin, peut };
  }, [user, chargement, connexion, deconnexion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
