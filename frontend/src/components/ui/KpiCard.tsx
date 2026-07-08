import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

export function KpiCard({
  titre,
  valeur,
  icone: Icone,
  couleurIcone = "#0E5E7C",
  fondIcone = "#E3EFF3",
  valeurCouleur,
  bas,
}: {
  titre: string;
  valeur: ReactNode;
  icone: LucideIcon;
  couleurIcone?: string;
  fondIcone?: string;
  valeurCouleur?: string;
  bas?: ReactNode;
}) {
  return (
    <div className="carte p-[17px_19px]">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-medium text-gris">{titre}</div>
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg"
          style={{ background: fondIcone }}
        >
          <Icone size={19} style={{ color: couleurIcone }} />
        </div>
      </div>
      <div
        className="mt-3 font-mono text-[33px] font-semibold tracking-tight"
        style={{ color: valeurCouleur ?? "#16262E" }}
      >
        {valeur}
      </div>
      {bas && <div className="mt-1 text-xs text-grisdoux">{bas}</div>}
    </div>
  );
}

export function TendanceHausse({ texte, valeur }: { valeur: string; texte: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <TrendingUp size={15} className="text-succes" />
      <span className="text-xs font-medium text-succes">{valeur}</span>
      <span className="text-xs text-grisdoux">{texte}</span>
    </div>
  );
}

export function BarreProgression({ valeur, couleur = "#1B8A4B" }: { valeur: number; couleur?: string }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#EEF2F3]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, valeur)}%`, background: couleur }}
      />
    </div>
  );
}
