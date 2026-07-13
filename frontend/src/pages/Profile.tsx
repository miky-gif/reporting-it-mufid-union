import { Check, FileSpreadsheet, FileText, FileType2, KeyRound, Loader2, Mail, Shield, User as UserIcon } from "lucide-react";
import { startOfMonth, subMonths } from "date-fns";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { telechargerFichier } from "@/lib/download";
import { Avatar } from "@/components/ui/Avatar";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import type { StatsEmploye } from "@/types";
import { formatDate, formatDuree, formatPoints, isoDate } from "@/lib/format";

export default function Profile() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsEmploye | null>(null);

  useEffect(() => {
    api.get<StatsEmploye>("/stats/employe").then((r) => setStats(r.data));
  }, []);

  if (!user) return <Spinner />;

  return (
    <>
      <EnteteSection titre="Mon profil" sousTitre="Vos informations, votre rapport d'activité et votre mot de passe." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="carte p-7">
          <div className="flex items-center gap-4">
            <Avatar nom={user.nom_complet} id={user.id} taille={64} />
            <div>
              <div className="text-lg font-semibold text-encre">{user.nom_complet}</div>
              <div className="text-[13.5px] text-gris">{user.poste ?? "—"}</div>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3.5">
            <LigneInfo icone={Mail} label="E-mail" valeur={user.email} />
            <LigneInfo icone={Shield} label="Rôle" valeur={user.role === "ADMIN" ? "Administrateur" : "IT"} />
            <LigneInfo icone={UserIcon} label="Membre depuis" valeur={formatDate(user.date_creation)} />
          </div>
        </div>

        <div className="carte p-7">
          <div className="mb-4 text-[15px] font-semibold text-encre">Récapitulatif de mon activité</div>
          {!stats ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatBloc label="Total activités" valeur={String(stats.total_activites)} />
              <StatBloc label="Heures réalisées" valeur={formatDuree(stats.minutes_realisees)} couleur="#0E5E7C" />
              <StatBloc label="Mes points" valeur={formatPoints(stats.points_acquis)} couleur="#B4750E" />
              <StatBloc label="En retard" valeur={String(stats.en_retard)} couleur={stats.en_retard > 0 ? "#C0392B" : undefined} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TelechargerRapport />
        <ChangerMotDePasse />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Téléchargement de mon rapport d'activité                            */
/* ------------------------------------------------------------------ */
function TelechargerRapport() {
  const [debut, setDebut] = useState(isoDate(startOfMonth(subMonths(new Date(), 1))));
  const [fin, setFin] = useState(isoDate(new Date()));
  const [tele, setTele] = useState<"pdf" | "word" | "excel" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function exporter(format: "pdf" | "word" | "excel") {
    setErreur(null);
    setTele(format);
    try {
      await telechargerFichier("/rapports/mien", { date_debut: debut, date_fin: fin, format });
    } catch (err) {
      setErreur(messageErreur(err, "Téléchargement impossible."));
    } finally {
      setTele(null);
    }
  }

  return (
    <div className="carte p-7">
      <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-encre">
        <FileText size={18} className="text-petrole-600" /> Mon rapport d'activité
      </div>
      <p className="mb-4 text-[12.5px] text-gris">Générez votre rapport personnel sur la période de votre choix.</p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Du</label>
          <input type="date" className="champ font-mono" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div>
          <label className="label">Au</label>
          <input type="date" className="champ font-mono" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>

      {erreur && <div className="mb-3 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2 text-[12.5px] text-danger">{erreur}</div>}

      <div className="flex flex-wrap gap-2.5">
        <button className="btn-primaire" disabled={!!tele} onClick={() => exporter("word")}>
          {tele === "word" ? <Loader2 size={18} className="animate-spin" /> : <FileType2 size={18} />} Word
        </button>
        <button className="btn-succes" disabled={!!tele} onClick={() => exporter("excel")}>
          {tele === "excel" ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />} Excel
        </button>
        <button className="btn-danger" disabled={!!tele} onClick={() => exporter("pdf")}>
          {tele === "pdf" ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />} PDF
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Changement de mot de passe                                          */
/* ------------------------------------------------------------------ */
function ChangerMotDePasse() {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirme, setConfirme] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; texte: string } | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (nouveau.length < 6) return setMessage({ type: "err", texte: "Le nouveau mot de passe doit faire 6 caractères minimum." });
    if (nouveau !== confirme) return setMessage({ type: "err", texte: "La confirmation ne correspond pas." });
    setEnCours(true);
    try {
      await api.post("/auth/mot-de-passe", { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau });
      setMessage({ type: "ok", texte: "Mot de passe mis à jour." });
      setAncien(""); setNouveau(""); setConfirme("");
    } catch (err) {
      setMessage({ type: "err", texte: messageErreur(err, "Modification impossible.") });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="carte p-7">
      <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-encre">
        <KeyRound size={18} className="text-petrole-600" /> Changer mon mot de passe
      </div>
      <p className="mb-4 text-[12.5px] text-gris">Choisissez un mot de passe d'au moins 6 caractères.</p>

      <form onSubmit={soumettre} className="flex flex-col gap-3">
        <div>
          <label className="label">Mot de passe actuel</label>
          <input type="password" className="champ" value={ancien} onChange={(e) => setAncien(e.target.value)} autoComplete="current-password" required />
        </div>
        <div>
          <label className="label">Nouveau mot de passe</label>
          <input type="password" className="champ" value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" required />
        </div>
        <div>
          <label className="label">Confirmer le nouveau mot de passe</label>
          <input type="password" className="champ" value={confirme} onChange={(e) => setConfirme(e.target.value)} autoComplete="new-password" required />
        </div>

        {message && (
          <div
            className={
              "rounded-lg border px-3 py-2 text-[12.5px] " +
              (message.type === "ok" ? "border-[#B7DEC9] bg-succes/5 text-succes" : "border-[#EBC7C1] bg-danger/5 text-danger")
            }
          >
            {message.texte}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={enCours} className="btn-primaire">
            {enCours ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Mettre à jour
          </button>
        </div>
      </form>
    </div>
  );
}

function LigneInfo({ icone: Icone, label, valeur }: { icone: typeof Mail; label: string; valeur: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-bordure bg-surface px-3.5 py-3">
      <Icone size={18} className="text-petrole-600" />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-grisdoux">{label}</div>
        <div className="text-[13.5px] font-medium text-encre">{valeur}</div>
      </div>
    </div>
  );
}

function StatBloc({ label, valeur, couleur = "#16262E" }: { label: string; valeur: string; couleur?: string }) {
  return (
    <div className="rounded-xl2 border border-[#EEF2F3] p-4">
      <div className="text-[11.5px] text-grisdoux">{label}</div>
      <div className="mt-1.5 font-mono text-[27px] font-semibold" style={{ color: couleur }}>
        {valeur}
      </div>
    </div>
  );
}
