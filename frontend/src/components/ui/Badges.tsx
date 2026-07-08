// Badges de statut, priorité et catégorie — fidèles à la maquette.
import { PRIORITES, STATUTS } from "@/lib/constants";
import { useCategories } from "@/context/CategoriesContext";
import type { Categorie, Priorite, Statut } from "@/types";

export function StatutBadge({ statut }: { statut: Statut }) {
  const s = STATUTS[statut];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ color: s.couleur, background: s.fond }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: s.couleur }} />
      {s.libelle}
    </span>
  );
}

export function PrioriteBadge({ priorite }: { priorite: Priorite }) {
  const p = PRIORITES[priorite];
  return (
    <span
      className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
      style={{ color: p.couleur, background: p.fond }}
    >
      {p.libelle}
    </span>
  );
}

export function CategorieTag({
  categorie,
  compact = false,
}: {
  categorie: Categorie;
  compact?: boolean;
}) {
  const { infoOf } = useCategories();
  const c = infoOf(categorie);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-grisdoux">
        <span className="h-[7px] w-[7px] rounded-sm" style={{ background: c.couleur }} />
        {c.nom}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-[#E8EDEE] bg-surface px-2.5 py-1 text-xs font-medium text-ardoise">
      <span className="h-2 w-2 rounded-sm" style={{ background: c.couleur }} />
      {c.nom}
    </span>
  );
}
