import { AlertTriangle, Loader2, Repeat2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { StatutBadge } from "@/components/ui/Badges";
import type { Activite, UserWithStats } from "@/types";

/**
 * Réaffectation d'une tâche à un autre agent (agent indisponible, en retard,
 * ou non compétent sur le sujet). Réservé à l'administrateur.
 */
export function ReassignModal({
  activite,
  onFermer,
  onSucces,
}: {
  activite: Activite;
  onFermer: () => void;
  onSucces: () => void;
}) {
  const [agents, setAgents] = useState<UserWithStats[] | null>(null);
  const [cible, setCible] = useState<number>(0);
  const [motif, setMotif] = useState("");
  const [reinitialiser, setReinitialiser] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Nouvelle période / durée : sans quoi une tâche déjà en retard le resterait
  // pour le nouvel agent, ce qui n'aurait aucun sens.
  const [dateDebut, setDateDebut] = useState(activite.date_debut ?? activite.date_activite);
  const [dateFin, setDateFin] = useState(activite.date_fin ?? activite.date_activite);
  const minutesInit = activite.duree_minutes || 60;
  const enHeures = minutesInit >= 60 && minutesInit % 60 === 0;
  const [unite, setUnite] = useState<"MIN" | "H">(enHeures ? "H" : "MIN");
  const [dureeSaisie, setDureeSaisie] = useState(String(enHeures ? minutesInit / 60 : minutesInit));

  const dureeMinutes = (() => {
    const v = parseFloat(dureeSaisie.replace(",", "."));
    if (Number.isNaN(v) || v <= 0) return 0;
    return Math.round(unite === "H" ? v * 60 : v);
  })();

  useEffect(() => {
    api.get<UserWithStats[]>("/users").then((r) => {
      // Uniquement les IT actifs, hors agent courant.
      setAgents(r.data.filter((u) => u.actif && u.role === "EMPLOYE" && u.id !== activite.user_id));
    });
  }, [activite.user_id]);

  async function soumettre() {
    setErreur(null);
    if (!cible) return setErreur("Sélectionnez l'agent à qui confier la tâche.");
    if (dateFin < dateDebut) return setErreur("La date de fin doit être postérieure ou égale à la date de début.");
    if (dureeMinutes < 1 || dureeMinutes > 1440) return setErreur("Durée invalide (1 minute à 24 h).");
    setEnCours(true);
    try {
      await api.post(`/activites/${activite.id}/reaffecter`, {
        user_id: cible,
        motif: motif.trim() || undefined,
        reinitialiser,
        date_debut: dateDebut,
        date_fin: dateFin,
        duree_minutes: dureeMinutes,
      });
      onSucces();
    } catch (err) {
      setErreur(messageErreur(err, "Réaffectation impossible."));
    } finally {
      setEnCours(false);
    }
  }

  const cloturee = activite.statut === "CLOTURE";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-encre/40" onClick={onFermer} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl2 border border-bordure bg-white shadow-popover">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-[#EEF2F3] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Repeat2 size={19} className="text-petrole-600" />
            <span className="text-[15px] font-semibold text-encre">Réaffecter la tâche</span>
          </div>
          <button onClick={onFermer} className="text-grisdoux hover:text-encre">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Rappel de la tâche */}
          <div className="mb-5 rounded-lg border border-bordure bg-surface px-3.5 py-3">
            <div className="mb-1.5 text-[13.5px] font-semibold text-encre">{activite.titre}</div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-gris">
              <StatutBadge statut={activite.statut} />
              <span>·</span>
              <span>Actuellement : <strong className="text-ardoise">{activite.user?.nom_complet ?? "—"}</strong></span>
              <span>·</span>
              <span className="font-mono">{activite.pourcentage}% réalisé</span>
            </div>
          </div>

          {cloturee ? (
            <div className="flex items-start gap-2 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
              <AlertTriangle size={16} className="mt-0.5 flex-none" />
              Une tâche <strong>clôturée</strong> ne peut plus être réaffectée.
            </div>
          ) : (
            <>
              {/* Agent destinataire */}
              <div className="mb-[18px]">
                <label className="label">Confier à <span className="text-danger">*</span></label>
                {!agents ? (
                  <div className="text-[12.5px] text-grisdoux">Chargement…</div>
                ) : agents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#C6D2D7] px-3 py-3 text-[12.5px] text-grisdoux">
                    Aucun autre agent actif disponible.
                  </div>
                ) : (
                  <div className="max-h-[176px] overflow-y-auto rounded-lg border border-bordure">
                    {agents.map((a) => (
                      <label
                        key={a.id}
                        className={
                          "flex cursor-pointer items-center gap-2.5 border-b border-[#F4F6F7] px-3 py-2 last:border-0 hover:bg-surface " +
                          (cible === a.id ? "bg-petrole-50/60" : "")
                        }
                      >
                        <input type="radio" name="cible" checked={cible === a.id} onChange={() => setCible(a.id)} />
                        <Avatar nom={a.nom_complet} id={a.id} taille={26} />
                        <span className="text-[13px] font-medium text-encre">{a.nom_complet}</span>
                        <span className="ml-auto text-[11.5px] text-grisdoux">{a.poste ?? "—"}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Alerte si la tâche est déjà en retard */}
              {activite.en_retard && (
                <div className="mb-[18px] flex items-start gap-2 rounded-lg border border-[#F0D8A8] bg-attention/10 px-3 py-2.5 text-[12.5px] text-ardoise">
                  <AlertTriangle size={16} className="mt-0.5 flex-none text-attention" />
                  <span>
                    Cette tâche est <strong>en retard</strong> (échéance dépassée). Redéfinissez la période
                    ci-dessous, sinon elle restera marquée en retard pour le nouvel agent.
                  </span>
                </div>
              )}

              {/* Nouvelle période + durée */}
              <div className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Début</label>
                  <input type="date" className="champ font-mono" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                </div>
                <div>
                  <label className="label">Fin (échéance)</label>
                  <input type="date" className="champ font-mono" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                </div>
                <div>
                  <label className="label">Durée</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step={unite === "H" ? "0.25" : "1"}
                      min="0"
                      className="champ flex-1 font-mono"
                      value={dureeSaisie}
                      onChange={(e) => setDureeSaisie(e.target.value)}
                    />
                    <select className="champ w-[92px]" value={unite} onChange={(e) => setUnite(e.target.value as "MIN" | "H")}>
                      <option value="MIN">min</option>
                      <option value="H">h</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Motif */}
              <div className="mb-[18px]">
                <label className="label">Motif de la réaffectation</label>
                <textarea
                  rows={2}
                  className="champ resize-y"
                  placeholder="Ex. agent indisponible, surcharge, compétence requise…"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                />
                <p className="mt-1 text-[11.5px] text-grisdoux">
                  Visible sur la tâche et transmis aux deux agents (notification + e-mail).
                </p>
              </div>

              {/* Réinitialisation */}
              <label className="mb-1 flex cursor-pointer items-start gap-2.5 rounded-lg border border-bordure px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={reinitialiser}
                  onChange={(e) => setReinitialiser(e.target.checked)}
                />
                <span className="text-[12.5px] leading-snug text-ardoise">
                  <strong>Repartir de zéro</strong> — la tâche repasse à « À faire » et 0 %.
                  <span className="block text-grisdoux">
                    Décochez pour conserver l'avancement du précédent agent ({activite.pourcentage}%).
                  </span>
                </span>
              </label>

              {erreur && (
                <div className="mt-3 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
                  {erreur}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F3] px-6 py-4">
          <button onClick={onFermer} className="btn-fantome">Annuler</button>
          {!cloturee && (
            <button onClick={soumettre} disabled={enCours || !cible} className="btn-primaire">
              {enCours ? <Loader2 size={18} className="animate-spin" /> : <Repeat2 size={18} />}
              Réaffecter et notifier
            </button>
          )}
        </div>
      </div>
    </>
  );
}
