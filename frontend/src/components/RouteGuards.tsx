import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Divers";

/** Bloque l'accès si non connecté. */
export function RequireAuth() {
  const { user, chargement } = useAuth();
  if (chargement) return <PleinEcran />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Réservé aux administrateurs. */
export function RequireAdmin() {
  const { estAdmin, chargement } = useAuth();
  if (chargement) return <PleinEcran />;
  if (!estAdmin) return <Navigate to="/" replace />;
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
