import { Award, Minus, Plus } from "lucide-react";
import { formatPoints } from "@/lib/format";

const MINUTES_PAR_POINT = 480; // 40 h = 5 points

/**
 * Ajustement manuel des points par l'admin (bonus/malus), en plus du calcul
 * automatique basé sur la durée. Le total effectif est borné à 0.
 */
export function AjustementPoints({
  dureeMinutes,
  ajustement,
  onChange,
  disabled,
}: {
  dureeMinutes: number;
  ajustement: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const base = Math.round(((dureeMinutes || 0) / MINUTES_PAR_POINT) * 1000) / 1000;
  const total = Math.max(0, Math.round((base + (ajustement || 0)) * 1000) / 1000);

  const ajuster = (delta: number) => {
    if (disabled) return;
    const v = Math.max(-100, Math.min(100, Math.round(((ajustement || 0) + delta) * 100) / 100));
    onChange(v);
  };

  const signe = ajustement > 0 ? "+" : "";
  const couleurAjust = ajustement > 0 ? "#1B8A4B" : ajustement < 0 ? "#C0392B" : "#8A99A1";

  return (
    <div className="mb-[18px] rounded-lg border border-[#F0E4C9] bg-[#FBF7EC] p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#B4750E]">
        <Award size={15} /> Points (pondération)
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
        <div>
          <span className="text-grisdoux">Automatique (durée) : </span>
          <span className="font-mono font-semibold text-ardoise">{formatPoints(base)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-grisdoux">Ajustement :</span>
          <button
            type="button"
            onClick={() => ajuster(-0.5)}
            disabled={disabled}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-bordure bg-white text-danger hover:bg-danger/5 disabled:opacity-50"
            title="Retirer 0,5 point (malus)"
          >
            <Minus size={15} />
          </button>
          <input
            type="number"
            step="0.5"
            className="champ w-[78px] py-1.5 text-center font-mono"
            value={ajustement}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
          <button
            type="button"
            onClick={() => ajuster(0.5)}
            disabled={disabled}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-bordure bg-white text-succes hover:bg-succes/5 disabled:opacity-50"
            title="Ajouter 0,5 point (bonus)"
          >
            <Plus size={15} />
          </button>
          {ajustement !== 0 && (
            <span className="font-mono font-semibold" style={{ color: couleurAjust }}>
              {signe}
              {formatPoints(ajustement)}
            </span>
          )}
        </div>

        <div className="ml-auto rounded-md bg-white px-2.5 py-1">
          <span className="text-grisdoux">Total : </span>
          <span className="font-mono text-[14px] font-bold text-[#B4750E]">{formatPoints(total)}</span>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-grisdoux">
        Bonus si la tâche était complexe ou l'agent brillant ; malus si le travail a été médiocre.
        Le total sert au classement des contributeurs (jamais négatif).
      </p>
    </div>
  );
}
