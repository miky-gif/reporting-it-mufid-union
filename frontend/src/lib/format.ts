// Helpers de formatage (dates, durées, initiales) en français.
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function initiales(nom: string): string {
  const parties = nom.trim().split(/\s+/).filter(Boolean);
  if (parties.length === 0) return "?";
  if (parties.length === 1) return parties[0].slice(0, 2).toUpperCase();
  return (parties[0][0] + parties[parties.length - 1][0]).toUpperCase();
}

/** Durée « 3,5 h » (virgule décimale française). */
export function formatHeures(h: number): string {
  const s = Number.isInteger(h) ? String(h) : String(h).replace(".", ",");
  return `${s} h`;
}

/** Durée en minutes -> « 45 min », « 1 h », « 1 h 30 ». */
export function formatDuree(minutes: number): string {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const reste = m % 60;
  if (h === 0) return `${reste} min`;
  if (reste === 0) return `${h} h`;
  return `${h} h ${String(reste).padStart(2, "0")}`;
}

/** Points (pondération) « 2,5 pts ». */
export function formatPoints(p: number): string {
  const s = Number.isInteger(p) ? String(p) : String(Math.round(p * 100) / 100).replace(".", ",");
  return `${s} pt${p >= 2 ? "s" : ""}`;
}

/** Date « 03/07/2026 ». */
export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

/** Date longue « vendredi 3 juillet 2026 ». */
export function formatDateLongue(d: Date = new Date()): string {
  return format(d, "EEEE d MMMM yyyy", { locale: fr });
}

/** Format ISO court AAAA-MM-JJ pour les inputs de type date. */
export function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
