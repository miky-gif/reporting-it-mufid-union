import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { CATEGORIES as FALLBACK } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import type { CategorieDef } from "@/types";

interface CategoriesContextValue {
  categories: CategorieDef[]; // toutes (actives + inactives)
  actives: CategorieDef[]; // uniquement actives (pour les listes déroulantes)
  chargement: boolean;
  infoOf: (code: string) => { nom: string; couleur: string };
  rubriquesOf: (code: string) => string[];
  recharger: () => Promise<void>;
}

const Ctx = createContext<CategoriesContextValue | undefined>(undefined);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategorieDef[]>([]);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    try {
      const { data } = await api.get<CategorieDef[]>("/categories");
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setChargement(true);
      recharger();
    } else {
      setCategories([]);
      setChargement(false);
    }
  }, [user, recharger]);

  const byCode = useMemo(() => {
    const m = new Map<string, CategorieDef>();
    for (const c of categories) m.set(c.code, c);
    return m;
  }, [categories]);

  const value = useMemo<CategoriesContextValue>(
    () => ({
      categories,
      actives: categories.filter((c) => c.actif),
      chargement,
      infoOf: (code) => {
        const c = byCode.get(code);
        if (c) return { nom: c.nom, couleur: c.couleur };
        const fb = FALLBACK[code];
        if (fb) return { nom: fb.libelle, couleur: fb.couleur };
        return { nom: code, couleur: "#8A99A1" };
      },
      rubriquesOf: (code) => byCode.get(code)?.rubriques ?? [],
      recharger,
    }),
    [categories, chargement, byCode, recharger],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCategories doit être utilisé dans un CategoriesProvider");
  return ctx;
}
