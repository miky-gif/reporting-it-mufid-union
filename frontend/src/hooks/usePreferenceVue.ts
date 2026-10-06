import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type Vue = "liste" | "tableau";

/** Préférence d'affichage des activités, retenue d'une session à l'autre. */
const CLE_VUE = "mufid_vue_activites";

/** Le tableau (kanban) est l'affichage par défaut. */
const DEFAUT: Vue = "tableau";

function lire(): Vue {
  try {
    return localStorage.getItem(CLE_VUE) === "liste" ? "liste" : DEFAUT;
  } catch {
    // Navigation privée ou stockage bloqué : on retombe sur le défaut.
    return DEFAUT;
  }
}

/**
 * Choix « liste » ou « tableau » pour les écrans d'activités.
 *
 * L'URL garde la priorité : un lien explicite comme `?vue=liste` (celui du
 * bandeau Standby, par exemple) montre bien la liste sans pour autant modifier
 * la préférence. Seul un clic sur la bascule enregistre le choix, qui survit
 * alors à la déconnexion puisqu'il est écrit hors de la session.
 */
export function usePreferenceVue(): [Vue, (v: Vue) => void] {
  const [params, setParams] = useSearchParams();

  const dansUrl = params.get("vue");
  const vue: Vue = dansUrl === "liste" || dansUrl === "tableau" ? dansUrl : lire();

  const setVue = useCallback(
    (v: Vue) => {
      try {
        localStorage.setItem(CLE_VUE, v);
      } catch {
        // Le choix ne sera pas retenu, mais l'affichage change quand même.
      }
      const p = new URLSearchParams(params);
      p.set("vue", v);
      p.delete("page"); // la pagination d'une vue n'a pas de sens dans l'autre
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

  return [vue, setVue];
}
