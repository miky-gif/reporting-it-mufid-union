import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  total,
  taille,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  taille: number;
  onChange: (page: number) => void;
}) {
  const debut = total === 0 ? 0 : (page - 1) * taille + 1;
  const fin = Math.min(total, page * taille);
  const pages = pagesVisibles(page, totalPages);

  return (
    <div className="flex items-center justify-between bg-[#FAFBFB] px-[18px] py-3.5">
      <div className="text-[12.5px] text-grisdoux">
        Affichage <span className="font-mono text-ardoise">{debut}–{fin}</span> sur{" "}
        <span className="font-mono text-ardoise">{total}</span> activités
      </div>
      <div className="flex items-center gap-1.5">
        <BoutonPage disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={18} />
        </BoutonPage>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={i} className="px-1 font-mono text-[13px] text-grisdoux">…</span>
          ) : (
            <button
              key={i}
              onClick={() => onChange(p as number)}
              className={
                "flex h-8 w-8 items-center justify-center rounded-[7px] font-mono text-[13px] " +
                (p === page
                  ? "bg-petrole-600 font-semibold text-white"
                  : "border border-bordure text-ardoise hover:bg-surface")
              }
            >
              {p}
            </button>
          ),
        )}
        <BoutonPage disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight size={18} />
        </BoutonPage>
      </div>
    </div>
  );
}

function BoutonPage({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-bordure text-gris disabled:text-[#C6D2D7] enabled:hover:bg-surface"
    >
      {children}
    </button>
  );
}

function pagesVisibles(page: number, total: number): (number | "…")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (page > 3) pages.push("…");
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) pages.push(p);
  if (page < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
