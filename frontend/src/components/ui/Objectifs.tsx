import { Check, Plus, X } from "lucide-react";
import type { ObjectifSaisi } from "@/types";

/** Avancement d'un objectif, borné à 100 % (un dépassement reste « atteint »). */
export function avancementObjectif(o: ObjectifSaisi): number {
  const cible = Number(o.cible) || 0;
  if (cible <= 0) return 0;
  return Math.min(100, Math.round(((Number(o.realise) || 0) / cible) * 100));
}

/** Avancement global = moyenne des objectifs. null s'il n'y en a aucun. */
export function avancementGlobal(liste: ObjectifSaisi[]): number | null {
  const utiles = liste.filter((o) => Number(o.cible) > 0);
  if (utiles.length === 0) return null;
  return Math.round(utiles.reduce((s, o) => s + avancementObjectif(o), 0) / utiles.length);
}

/** Vrai si tous les objectifs sont atteints. */
export const tousAtteints = (liste: ObjectifSaisi[]) =>
  liste.every((o) => (Number(o.realise) || 0) >= (Number(o.cible) || 0));

const OBJECTIF_VIDE: ObjectifSaisi = { libelle: "", type: "QUANTITATIF", cible: 1, realise: 0 };

/**
 * Objectifs d'une tâche.
 *  - « definition »  : l'administration fixe les libellés et les cibles.
 *  - « progression » : l'agent renseigne uniquement où il en est (cibles verrouillées).
 *  - « lecture »     : tâche clôturée, plus rien n'est modifiable.
 */
export function Objectifs({
  valeur,
  onChange,
  mode,
}: {
  valeur: ObjectifSaisi[];
  onChange: (liste: ObjectifSaisi[]) => void;
  mode: "definition" | "progression" | "lecture";
}) {
  const modifier = (i: number, champs: Partial<ObjectifSaisi>) =>
    onChange(valeur.map((o, idx) => (idx === i ? { ...o, ...champs } : o)));

  if (mode !== "definition" && valeur.length === 0) return null; // rien à montrer à l'agent

  return (
    <div>
      {mode === "definition" && (
        <p className="mb-3 text-[11.5px] leading-snug text-grisdoux">
          Indiquez ce que vous attendez concrètement. Précisez l'unité dans le libellé
          (ex. « Collecter 18 données terrain »).
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {valeur.map((o, i) => {
          const jalon = o.type === "JALON";
          const pct = avancementObjectif(o);
          const atteint = (Number(o.realise) || 0) >= (Number(o.cible) || 0);

          /* --- L'administration définit la cible --- */
          if (mode === "definition") {
            return (
              <div key={i} className="rounded-lg border border-bordure bg-surface p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    className="champ flex-1 py-1.5 text-[13px]"
                    maxLength={300}
                    placeholder="Ex. Collecter 18 données terrain"
                    value={o.libelle}
                    onChange={(e) => modifier(i, { libelle: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => onChange(valeur.filter((_, idx) => idx !== i))}
                    className="flex-none text-grisdoux hover:text-danger"
                    title="Retirer cet objectif"
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-0.5">
                  <select
                    className="champ w-[132px] py-1.5 text-[12px]"
                    value={o.type}
                    onChange={(e) =>
                      modifier(i, {
                        type: e.target.value as ObjectifSaisi["type"],
                        cible: e.target.value === "JALON" ? 1 : o.cible || 1,
                      })
                    }
                  >
                    <option value="QUANTITATIF">Cible chiffrée</option>
                    <option value="JALON">Fait / pas fait</option>
                  </select>
                  {!jalon && (
                    <>
                      <span className="text-[12px] text-gris">à atteindre :</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="champ w-[96px] py-1.5 text-center font-mono text-[12.5px]"
                        value={o.cible}
                        onChange={(e) => modifier(i, { cible: Number(e.target.value) })}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          }

          /* --- L'agent renseigne sa progression (ou simple lecture) --- */
          return (
            <div key={o.id ?? i} className="rounded-lg border border-bordure bg-surface p-2.5">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 break-words text-[13px] font-medium text-encre">
                  {o.libelle}
                </span>
                {atteint && (
                  <span className="flex flex-none items-center gap-1 rounded bg-succes/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-succes">
                    <Check size={12} /> atteint
                  </span>
                )}
              </div>

              {jalon ? (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-ardoise">
                  <input
                    type="checkbox"
                    className="accent-petrole-600"
                    disabled={mode === "lecture"}
                    checked={(Number(o.realise) || 0) >= 1}
                    onChange={(e) => modifier(i, { realise: e.target.checked ? 1 : 0 })}
                  />
                  Fait
                </label>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E4EBEE]">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${pct}%`, background: atteint ? "#1B8A4B" : "#0E5E7C" }}
                      />
                    </div>
                    <span className="flex-none font-mono text-[12px] font-semibold text-encre">
                      {Number(o.realise) || 0} / {o.cible}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[12px] text-gris">Où j'en suis :</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="champ w-[104px] py-1.5 text-center font-mono text-[12.5px]"
                      disabled={mode === "lecture"}
                      value={o.realise}
                      onChange={(e) => modifier(i, { realise: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {mode === "definition" && valeur.length === 0 && (
          <p className="text-[12.5px] text-grisdoux">
            Aucun objectif. La tâche gardera un pourcentage de réalisation saisi à la main.
          </p>
        )}
      </div>

      {mode === "definition" && (
        <button
          type="button"
          onClick={() => onChange([...valeur, { ...OBJECTIF_VIDE }])}
          className="btn-secondaire mt-2.5 px-2.5 py-1.5 text-[12.5px]"
          disabled={valeur.length >= 12}
        >
          <Plus size={16} /> Ajouter un objectif
        </button>
      )}
    </div>
  );
}
