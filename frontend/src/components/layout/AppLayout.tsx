import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  // Navigation en tiroir sous le point de rupture « lg » (tablette / mobile).
  const [menuOuvert, setMenuOuvert] = useState(false);
  const location = useLocation();

  // Changer de page referme le tiroir (sinon il masquerait le contenu).
  useEffect(() => setMenuOuvert(false), [location.pathname]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <Header navOuverte={menuOuvert} onBasculerNav={() => setMenuOuvert((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar ouvert={menuOuvert} onFermer={() => setMenuOuvert(false)} />
        {/* Marges resserrées sur petit écran pour gagner de la largeur utile. */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-[26px_30px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
