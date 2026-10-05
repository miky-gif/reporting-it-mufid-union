import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gris">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EtatVide({
  icone: Icone,
  titre,
  description,
  action,
}: {
  icone: LucideIcon;
  titre: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center sm:px-10 sm:py-14">
      <div className="mb-5 flex h-[74px] w-[74px] items-center justify-center rounded-full bg-petrole-100">
        <Icone size={34} className="text-petrole-600" />
      </div>
      <div className="text-lg font-semibold text-encre">{titre}</div>
      <div className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-gris">{description}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function EnteteSection({
  titre,
  sousTitre,
  action,
}: {
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight text-encre sm:text-[23px]">{titre}</h1>
        {sousTitre && <p className="mt-1 text-[13px] text-gris sm:text-[13.5px]">{sousTitre}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}
