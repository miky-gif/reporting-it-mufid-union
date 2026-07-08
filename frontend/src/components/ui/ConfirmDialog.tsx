import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  ouvert,
  titre,
  message,
  libelleConfirmer = "Confirmer",
  danger = true,
  onConfirmer,
  onAnnuler,
}: {
  ouvert: boolean;
  titre: string;
  message: string;
  libelleConfirmer?: string;
  danger?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-encre/40 p-4" onClick={onAnnuler}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-panneau"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={"flex h-11 w-11 flex-none items-center justify-center rounded-full " + (danger ? "bg-danger/10" : "bg-petrole-100")}>
            <AlertTriangle size={22} className={danger ? "text-danger" : "text-petrole-600"} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-encre">{titre}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-gris">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onAnnuler} className="btn-fantome">Annuler</button>
          <button
            onClick={onConfirmer}
            className={danger ? "btn bg-danger text-white hover:brightness-95" : "btn-primaire"}
          >
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </div>
  );
}
