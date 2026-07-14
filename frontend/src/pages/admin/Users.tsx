import { MoreVertical, Pencil, ShieldCheck, UserCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { ROLES } from "@/lib/constants";
import type { Role, UserWithStats } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserModal } from "./UserModal";

export default function UsersPage() {
  const { user: courant } = useAuth();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [modal, setModal] = useState<{ ouvert: boolean; user?: UserWithStats }>({ ouvert: false });
  const [aDesactiver, setADesactiver] = useState<UserWithStats | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);

  function charger() {
    setChargement(true);
    api.get<UserWithStats[]>("/users").then((r) => setUsers(r.data)).finally(() => setChargement(false));
  }
  useEffect(charger, []);

  async function desactiver() {
    if (!aDesactiver) return;
    try {
      await api.delete(`/users/${aDesactiver.id}`);
      setADesactiver(null);
      charger();
    } catch (err) {
      alert(messageErreur(err));
    }
  }

  const filtres = users.filter(
    (u) =>
      u.nom_complet.toLowerCase().includes(recherche.toLowerCase()) ||
      u.email.toLowerCase().includes(recherche.toLowerCase()),
  );
  const nbActifs = users.filter((u) => u.actif).length;
  const nbAdmins = users.filter((u) => u.role === "ADMIN").length;

  return (
    <>
      <EnteteSection
        titre="Utilisateurs"
        sousTitre={`${users.length} membre(s) du service — ${nbActifs} actif(s).`}
        action={
          <button className="btn-primaire" onClick={() => setModal({ ouvert: true })}>
            <UserPlus size={18} /> Inviter un utilisateur
          </button>
        }
      />

      {/* Mini stats */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat icone={UsersIcon} valeur={users.length} label="Utilisateurs" />
        <MiniStat icone={UserCheck} valeur={nbActifs} label="Actifs" couleur="#1B8A4B" fond="#E4F5EB" />
        <MiniStat icone={ShieldCheck} valeur={nbAdmins} label="Administrateur(s)" />
      </div>

      <div className="carte overflow-hidden">
        <div className="border-b border-[#EEF2F3] px-[18px] py-3.5">
          <div className="flex max-w-[320px] items-center gap-2.5 rounded-lg border border-[#E8EDEE] bg-surface px-3 py-2.5">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un utilisateur…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-grisdoux"
            />
          </div>
        </div>

        {chargement ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[#EEF2F3] bg-[#FAFBFB] text-left text-[11px] uppercase tracking-wide text-grisdoux">
                  <th className="px-[18px] py-2.5 font-semibold">Utilisateur</th>
                  <th className="py-2.5 font-semibold">Accès</th>
                  <th className="py-2.5 font-semibold">Département</th>
                  <th className="py-2.5 font-semibold">Statut</th>
                  <th className="py-2.5 text-right font-semibold">Activités</th>
                  <th className="py-2.5 font-semibold">Membre depuis</th>
                  <th className="px-[18px] py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtres.map((u) => (
                  <tr key={u.id} className="border-b border-[#F4F6F7] last:border-0">
                    <td className="px-[18px] py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nom={u.nom_complet} id={u.id} couleur={u.role === "ADMIN" ? "#0E5E7C" : undefined} taille={38} />
                        <div>
                          <div className="text-[13.5px] font-semibold text-encre">{u.nom_complet}</div>
                          <div className="text-[12px] text-grisdoux">{u.poste ?? "—"} · {u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3"><BadgeRole role={u.role} /></td>
                    <td className="py-3"><BadgeDepartement dep={u.departement} /></td>
                    <td className="py-3"><BadgeStatut actif={u.actif} /></td>
                    <td className="py-3 text-right font-mono text-[13px] text-ardoise">{u.nb_activites}</td>
                    <td className="py-3 text-[12.5px] text-gris">{formatDate(u.date_creation)}</td>
                    <td className="px-[18px] py-3 text-right">
                      <div className="relative inline-block">
                        <button onClick={() => setMenuId(menuId === u.id ? null : u.id)} className="text-grisdoux hover:text-ardoise">
                          <MoreVertical size={20} />
                        </button>
                        {menuId === u.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-bordure bg-white p-1.5 shadow-popover">
                              <button
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ardoise hover:bg-surface"
                                onClick={() => { setMenuId(null); setModal({ ouvert: true, user: u }); }}
                              >
                                <Pencil size={16} /> Modifier
                              </button>
                              {u.actif && u.id !== courant?.id && (
                                <button
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-danger hover:bg-danger/5"
                                  onClick={() => { setMenuId(null); setADesactiver(u); }}
                                >
                                  <UserCheck size={16} /> Désactiver
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.ouvert && (
        <UserModal
          user={modal.user}
          onClose={() => setModal({ ouvert: false })}
          onSaved={() => { setModal({ ouvert: false }); charger(); }}
        />
      )}

      <ConfirmDialog
        ouvert={!!aDesactiver}
        titre="Désactiver l'utilisateur"
        message={`${aDesactiver?.nom_complet ?? ""} ne pourra plus se connecter. Ses activités sont conservées (suppression logique).`}
        libelleConfirmer="Désactiver"
        onConfirmer={desactiver}
        onAnnuler={() => setADesactiver(null)}
      />
    </>
  );
}

function MiniStat({ icone: Icone, valeur, label, couleur = "#0E5E7C", fond = "#E3EFF3" }: { icone: typeof UsersIcon; valeur: number; label: string; couleur?: string; fond?: string }) {
  return (
    <div className="carte flex items-center gap-3.5 p-[16px_18px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-[9px]" style={{ background: fond }}>
        <Icone size={21} style={{ color: couleur }} />
      </div>
      <div>
        <div className="font-mono text-2xl font-semibold leading-none text-encre">{valeur}</div>
        <div className="mt-1 text-xs text-grisdoux">{label}</div>
      </div>
    </div>
  );
}

function BadgeRole({ role }: { role: Role }) {
  const r = ROLES[role];
  const avecIcone = role !== "EMPLOYE";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: r.fond, color: r.couleur }}
    >
      {avecIcone && <ShieldCheck size={14} />} {r.libelle}
    </span>
  );
}

/** Département de rattachement (le super admin n'en a aucun : il les voit tous). */
function BadgeDepartement({ dep }: { dep: UserWithStats["departement"] }) {
  if (!dep) return <span className="text-[12px] italic text-grisdoux">Tous</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ardoise">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: dep.couleur }} />
      {dep.nom}
    </span>
  );
}

function BadgeStatut({ actif }: { actif: boolean }) {
  return actif ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F5EB] px-2.5 py-1 text-[11.5px] font-semibold text-succes">
      <span className="h-[7px] w-[7px] rounded-full bg-succes" /> Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF0DC] px-2.5 py-1 text-[11.5px] font-semibold text-[#B4750E]">
      <span className="h-[7px] w-[7px] rounded-full bg-attention" /> Inactif
    </span>
  );
}
