import { Window } from "happy-dom";

/** Boots a DOM, loads the card module once, and returns factories for tests. */
let loaded = false;

export async function boot() {
  if (!loaded) {
    const win = new Window({ url: "http://localhost:8123" });
    for (const k of ["window", "document", "HTMLElement", "customElements", "CustomEvent", "Event"]) {
      globalThis[k] = k === "window" ? win : win[k];
    }
    await import("../dist/speedtest-compact-card.js");
    loaded = true;
  }
}

/** A hass double: states plus a callApi stub feeding the sparkline. */
export function fakeHass(states = {}, history = []) {
  return {
    states,
    callApi: async () => [history.map(v => ({ state: String(v) }))]
  };
}

export function sensor(state, extra = {}) {
  return { state: String(state), attributes: extra };
}

/** Minutes ago, as an ISO timestamp. */
export function minutesAgo(m) {
  return new Date(Date.now() - m * 60000).toISOString();
}

/** Builds a card, applies config and hass, returns it ready to inspect. */
export async function makeCard(config, hass) {
  await boot();
  const el = document.createElement("speedtest-compact-card");
  el.setConfig(config);
  el.hass = hass;
  return el;
}

export const $ = (el, id) => el.shadowRoot.getElementById(id);
export const text = (el, id) => $(el, id).textContent;
export const hidden = (el, id) => $(el, id).classList.contains("hide");
