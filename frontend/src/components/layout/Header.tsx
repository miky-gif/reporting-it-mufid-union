import { ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Notifications } from "./Notifications";

export function Header({
  navOuverte = false,
  onBasculerNav,
}: {
  /** Tiroir de navigation ouvert (petits écrans). */
  navOuverte?: boolean;
  onBasculerNav?: () => void;
}) {
  const { user, estAdmin, deconnexion } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  if (!user) return null;

  return (
    <header className="flex h-[62px] flex-none items-center justify-between border-b border-bordure bg-white px-3 sm:px-[22px]">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
        {/* Ouvre la navigation en tiroir (masqué dès que la colonne est visible) */}
        <button
          type="button"
          onClick={onBasculerNav}
          aria-label={navOuverte ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={navOuverte}
          className="-ml-1 flex-none rounded-lg p-2 text-ardoise hover:bg-surface lg:hidden"
        >
          {navOuverte ? <X size={22} /> : <Menu size={22} />}
        </button>
        <img src="/logo-mufid.webp" alt="MUFID UNION" className="h-[26px] flex-none sm:h-[30px]" />
        <span className="hidden flex-none rounded-[5px] border border-[#CFE2E9] bg-petrole-100 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-petrole-600 sm:inline">
          {estAdmin ? "ADMIN" : "IT"}
        </span>
      </div>

      <div className="flex flex-none items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-2.5 rounded-lg border border-[#E8EDEE] bg-surface px-3 py-2.5 text-grisdoux md:flex">
          <Search size={18} />
          <span className="text-[13px]">
            {estAdmin ? "Rechercher employé, activité…" : "Rechercher une activité…"}
          </span>
        </div>
        <Notifications />
        <div className="hidden h-[30px] w-px bg-bordure sm:block" />

        <div className="relative">
          <button
            onClick={() => setMenuOuvert((v) => !v)}
            className="flex items-center gap-2.5"
          >
            <Avatar nom={user.nom_complet} id={user.id} couleur={estAdmin ? "#0E5E7C" : undefined} />
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-[13px] font-semibold text-encre">{user.nom_complet}</div>
              <div className="text-[11px] text-grisdoux">{user.poste ?? "—"}</div>
            </div>
            <ChevronDown size={20} className="text-[#B4BBBF]" />
          </button>

          {menuOuvert && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded-xl2 border border-bordure bg-white p-1.5 shadow-popover">
                <div className="border-b border-[#EEF2F3] px-3 py-2">
                  <div className="text-[13px] font-semibold text-encre">{user.nom_complet}</div>
                  <div className="text-[11px] text-grisdoux">{user.email}</div>
                </div>
                <button
                  onClick={deconnexion}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-danger hover:bg-danger/5"
                >
                  <LogOut size={17} /> Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={deconnexion} title="Se déconnecter" className="hidden sm:block">
          <LogOut size={22} className="text-grisdoux hover:text-danger" />
        </button>
      </div>
    </header>
  );
}
