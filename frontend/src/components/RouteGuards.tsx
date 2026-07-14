import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Divers";
import type { Permission } from "@/types";

/** Bloque l'accès si non connecté. */
export function RequireAuth() {
  const { user, chargement } = useAuth();
  if (chargement) return <PleinEcran />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Réservé à l'administration (admin de département ou super admin). */
export function RequireAdmin() {
  const { estAdmin, chargement } = useAuth();
  if (chargement) return <PleinEcran />;
  if (!estAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Réservé au super administrateur (départements, administrateurs). */
export function RequireSuperAdmin() {
  const { estSuperAdmin, chargement } = useAuth();
  if (chargement) return <PleinEcran />;
  if (!estSuperAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

/** Réservé aux détenteurs d'un droit précis (sinon retour au tableau de bord). */
export function RequirePermission({ droit }: { droit: Permission }) {
  const { peut, chargement } = useAuth();
  if (chargement) return <PleinEcran />;
  if (!peut(droit)) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

/** Redirige la racine vers le bon tableau de bord selon le rôle. */
export function RedirectionAccueil() {
  const { estAdmin } = useAuth();
  return <Navigate to={estAdmin ? "/admin" : "/"} replace />;
}

function PleinEcran() {
  return (
    <div className="flex h-screen items-center justify-center bg-fond">
      <Spinner label="Chargement de la session…" />
    </div>
  );
}
