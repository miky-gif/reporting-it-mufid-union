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
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  chargement: boolean;
  connexion: (email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => void;
  estAdmin: boolean;
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

  const value = useMemo<AuthContextValue>(
    () => ({ user, chargement, connexion, deconnexion, estAdmin: user?.role === "ADMIN" }),
    [user, chargement, connexion, deconnexion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
