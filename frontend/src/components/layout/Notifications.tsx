import { formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Notification, NotificationsReponse } from "@/types";

export function Notifications() {
  const navigate = useNavigate();
  const { estAdmin } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const charger = useCallback(() => {
    api
      .get<NotificationsReponse>("/notifications")
      .then((r) => {
        setItems(r.data.items);
        setNonLues(r.data.non_lues);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    charger();
    // Sondage léger toutes les 30 s pour les nouvelles affectations.
    timer.current = setInterval(charger, 30000);
    return () => clearInterval(timer.current);
  }, [charger]);

  async function marquerLu(n: Notification) {
    if (!n.lu) {
      await api.post(`/notifications/${n.id}/lu`).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
      setNonLues((c) => Math.max(0, c - 1));
    }
    setOuvert(false);
    // L'admin est dirigé vers la gestion des activités, l'employé vers ses activités.
    if (n.activite_id) navigate(estAdmin ? "/admin/activites" : "/activites");
  }

  async function toutMarquer() {
    await api.post("/notifications/lire-tout").catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, lu: true })));
    setNonLues(0);
  }

  return (
    <div className="relative">
      <button onClick={() => setOuvert((v) => !v)} className="relative" title="Notifications">
        <Bell size={22} className="text-gris" />
        {nonLues > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)} />
          <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-[360px] overflow-hidden rounded-xl2 border border-bordure bg-white shadow-popover">
            <div className="flex items-center justify-between border-b border-[#EEF2F3] px-4 py-3">
              <div className="text-[13px] font-semibold text-encre">
                Notifications {nonLues > 0 && <span className="text-grisdoux">· {nonLues} non lue(s)</span>}
              </div>
              {nonLues > 0 && (
                <button onClick={toutMarquer} className="flex items-center gap-1 text-[12px] font-medium text-petrole-600">
                  <CheckCheck size={15} /> Tout lire
                </button>
              )}
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-grisdoux">
                  Aucune notification pour le moment.
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => marquerLu(n)}
                    className={
                      "flex w-full gap-3 border-b border-[#F4F6F7] px-4 py-3 text-left last:border-0 hover:bg-surface " +
                      (n.lu ? "" : "bg-petrole-50/60")
                    }
                  >
                    <span className={"mt-1.5 h-2 w-2 flex-none rounded-full " + (n.lu ? "bg-transparent" : "bg-petrole-600")} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-encre">{n.titre}</div>
                      <div className="mt-0.5 text-[12.5px] leading-snug text-gris">{n.message}</div>
                      <div className="mt-1 text-[11px] text-grisdoux">{tempsRelatif(n.date_creation)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function tempsRelatif(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: fr });
  } catch {
    return "";
  }
}
