import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * Liste déroulante pour les libellés LONGS (rubriques, noms d'agents…).
 *
 * Une liste native `<select>` ne sait pas mettre en forme ses options : elles
 * ne reviennent jamais à la ligne, et une rubrique longue finit tronquée par
 * le système, hors de toute maîtrise. Ce composant affiche donc son propre
 * panneau, où chaque option s'écrit sur plusieurs lignes si nécessaire.
 *
 * Il reste sobre : même allure que les autres champs, ouverture au clic,
 * fermeture par Échap ou clic à l'extérieur, navigation au clavier, et
 * recherche automatique dès que la liste s'allonge.
 */
/** Largeur maximale du panneau : au-delà, les libellés deviennent pénibles à lire. */
const LARGEUR_MAX_PANNEAU = 380;

export function ListeDeroulante({
  valeur,
  options,
  onChoisir,
  desactive = false,
  placeholder = "Sélectionnez…",
  seuilRecherche = 8,
  id,
}: {
  valeur: string;
  options: string[];
  onChoisir: (valeur: string) => void;
  desactive?: boolean;
  placeholder?: string;
  /** Nombre d'options à partir duquel un champ de recherche apparaît. */
  seuilRecherche?: number;
  id?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [survol, setSurvol] = useState(0);
  const [versLeHaut, setVersLeHaut] = useState(false);
  const [aligneADroite, setAligneADroite] = useState(false);

  const conteneur = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, recherche]);

  const avecRecherche = options.length >= seuilRecherche;

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", auClic);
    return () => document.removeEventListener("mousedown", auClic);
  }, [ouvert]);

  // À l'ouverture : on se cale sur la valeur courante et on vise le champ de recherche.
  useEffect(() => {
    if (!ouvert) {
      setRecherche("");
      return;
    }
    const i = options.indexOf(valeur);
    setSurvol(i >= 0 ? i : 0);
    if (avecRecherche) champRecherche.current?.focus();
  }, [ouvert, options, valeur, avecRecherche]);

  // Si le panneau dépasserait le bas de la fenêtre, on l'ouvre vers le haut.
  useLayoutEffect(() => {
    if (!ouvert || !bouton.current) return;
    const r = bouton.current.getBoundingClientRect();
    const hauteurPanneau = Math.min(320, filtrees.length * 44 + (avecRecherche ? 52 : 0) + 16);
    setVersLeHaut(r.bottom + hauteurPanneau > window.innerHeight && r.top > hauteurPanneau);
    // Le panneau peut dépasser la largeur du champ : s'il sortait de la
    // fenêtre par la droite, on l'accroche par son bord droit.
    setAligneADroite(r.left + LARGEUR_MAX_PANNEAU > window.innerWidth - 8 && r.right > LARGEUR_MAX_PANNEAU);
  }, [ouvert, filtrees.length, avecRecherche]);

  // L'option survolée reste toujours visible dans la liste.
  useEffect(() => {
    if (!ouvert) return;
    panneau.current?.querySelector<HTMLElement>(`[data-i="${survol}"]`)?.scrollIntoView({ block: "nearest" });
  }, [survol, ouvert]);

  function choisir(v: string) {
    onChoisir(v);
    setOuvert(false);
    bouton.current?.focus();
  }

  function auClavier(e: React.KeyboardEvent) {
    if (desactive) return;
    if (e.key === "Escape") {
      setOuvert(false);
      bouton.current?.focus();
      return;
    }
    if (!ouvert && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOuvert(true);
      return;
    }
    if (!ouvert) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSurvol((i) => Math.min(filtrees.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurvol((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choix = filtrees[survol];
      if (choix) choisir(choix);
    }
  }

  return (
    <div ref={conteneur} className="relative min-w-0" onKeyDown={auClavier}>
      <button
        id={id}
        ref={bouton}
        type="button"
        disabled={desactive}
        onClick={() => setOuvert((v) => !v)}
        title={valeur || undefined}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className={
          "champ flex items-center gap-2 text-left " +
          (desactive ? "cursor-not-allowed bg-surface text-gris" : "cursor-pointer") +
          (ouvert ? " border-petrole-600 ring-[3px] ring-petrole-600/15" : "")
        }
      >
        <span className={"min-w-0 flex-1 truncate " + (valeur ? "" : "text-grisdoux")}>
          {valeur || placeholder}
        </span>
        <ChevronDown
          size={17}
          className={"flex-none text-grisdoux transition-transform " + (ouvert ? "rotate-180" : "")}
        />
      </button>

      {ouvert && (
        <div
          ref={panneau}
          role="listbox"
          className={
            // Au moins aussi large que le champ, élargi au besoin jusqu'à une
            // limite lisible : sur un écran étroit le champ est serré, mais les
            // libellés doivent rester confortables à lire.
            "absolute z-30 min-w-full w-max max-w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-bordure bg-white shadow-popover " +
            (aligneADroite ? "right-0 " : "left-0 ") +
            (versLeHaut ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]")
          }
        >
          {avecRecherche && (
            <div className="flex items-center gap-2 border-b border-[#EEF2F3] px-3 py-2">
              <Search size={15} className="flex-none text-grisdoux" />
              <input
                ref={champRecherche}
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setSurvol(0);
                }}
                placeholder="Rechercher…"
                className="w-full bg-transparent text-[13px] text-encre outline-none placeholder:text-grisdoux"
              />
            </div>
          )}

          <div className="max-h-[260px] overflow-y-auto py-1">
            {filtrees.map((o, i) => {
              const choisie = o === valeur;
              return (
                <button
                  key={o}
                  type="button"
                  data-i={i}
                  role="option"
                  aria-selected={choisie}
                  onMouseEnter={() => setSurvol(i)}
                  onClick={() => choisir(o)}
                  className={
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] leading-snug transition " +
                    (i === survol ? "bg-petrole-50 " : "") +
                    (choisie ? "font-semibold text-petrole-600" : "text-ardoise")
                  }
                >
                  {/* break-words : c'est tout l'intérêt — une rubrique longue
                      s'affiche en entier, sur deux ou trois lignes s'il le faut. */}
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{o}</span>
                  {choisie && <Check size={15} className="mt-0.5 flex-none text-petrole-600" />}
                </button>
              );
            })}

            {filtrees.length === 0 && (
              <div className="px-3 py-4 text-center text-[12.5px] text-grisdoux">
                Aucune rubrique ne correspond.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
