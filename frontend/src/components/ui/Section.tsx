import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Section d'un formulaire : un seul niveau de regroupement, toujours visible.
 * C'est ELLE qui porte le titre et l'encadrement — les blocs qu'elle contient
 * n'ont donc pas à redessiner leur propre panneau (sinon on empile les cadres).
 */
export function Section({
  titre,
  icone: Icone,
  aide,
  compteur,
  children,
}: {
  titre: string;
  icone: LucideIcon;
  /** Information courte alignée à droite du titre (ex. « Avancement : 67 % »). */
  aide?: ReactNode;
  /** Pastille chiffrée (ex. nombre d'objectifs). */
  compteur?: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 border-t border-[#EEF2F3] pt-5 first:mt-0 first:border-0 first:pt-0">
      <div className="mb-3.5 flex items-center gap-2">
        <Icone size={16} className="flex-none text-petrole-600" />
        <h3 className="flex-none text-[13.5px] font-semibold text-encre">{titre}</h3>
        {compteur !== undefined && compteur > 0 && (
          <span className="flex-none rounded-full bg-petrole-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-petrole-600">
            {compteur}
          </span>
        )}
        {aide && <span className="ml-auto min-w-0 truncate text-[11.5px] text-grisdoux">{aide}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Barre d'action en bas du formulaire. Volontairement NON collante : on valide
 * après avoir parcouru le formulaire jusqu'au bout.
 */
export function BarreActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#EEF2F3] pt-5">
      {children}
    </div>
  );
}
