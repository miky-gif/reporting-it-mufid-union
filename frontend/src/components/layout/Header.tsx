import { ChevronDown, LogOut, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Notifications } from "./Notifications";

export function Header() {
  const { user, estAdmin, deconnexion } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  if (!user) return null;

  return (
    <header className="flex h-[62px] flex-none items-center justify-between border-b border-bordure bg-white px-[22px]">
      <div className="flex items-center gap-3.5">
        <img src="/logo-mufid.webp" alt="MUFID UNION" className="h-[30px]" />
        {estAdmin && (
          <span className="rounded-[5px] border border-[#CFE2E9] bg-petrole-100 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-petrole-600">
            ADMIN
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2.5 rounded-lg border border-[#E8EDEE] bg-surface px-3 py-2.5 text-grisdoux md:flex">
          <Search size={18} />
          <span className="text-[13px]">
            {estAdmin ? "Rechercher employé, activité…" : "Rechercher une activité…"}
          </span>
        </div>
        <Notifications />
        <div className="h-[30px] w-px bg-bordure" />

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

        <button onClick={deconnexion} title="Se déconnecter">
          <LogOut size={22} className="text-grisdoux hover:text-danger" />
        </button>
      </div>
    </header>
  );
}
