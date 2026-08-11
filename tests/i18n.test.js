import test from "node:test";
import assert from "node:assert/strict";
import { makeCard, fakeHass, sensor, minutesAgo, $, text } from "./helpers.js";

const BASE = {
  type: "custom:speedtest-compact-card",
  down: "sensor.down", ping: "sensor.ping", last: "sensor.last",
  max_down: 1000, ok_pct: 80, warn_pct: 60, stale_hours: 2
};
const withLang = (lang, states) => ({ ...fakeHass(states), locale: { language: lang } });
const states = (last = minutesAgo(12)) => ({
  "sensor.down": sensor(519.83),
  "sensor.ping": sensor(5.26),
  "sensor.last": sensor(last)
});

test("the age is phrased in the user language", async () => {
  const en = await makeCard(BASE, withLang("en", states()));
  const it = await makeCard(BASE, withLang("it", states()));
  assert.match(text(en, "ag"), /minute/);
  assert.match(text(it, "ag"), /minut/);
  assert.notEqual(text(en, "ag"), text(it, "ag"));
});

test("hours are used past the hour mark, in the user language", async () => {
  const it = await makeCard(BASE, withLang("it", states(minutesAgo(300))));
  assert.match(text(it, "ag"), /or/);
  assert.equal($(it, "ag").className, "stale");
});

test("the default footer stays in English, only its numbers localise", async () => {
  const en = await makeCard(BASE, withLang("en", states()));
  const it = await makeCard(BASE, withLang("it", states()));
  assert.equal(text(en, "pc"), "52% of 1,000 Mbit/s");
  // Italian CLDR does not group four-digit numbers: 1000, not 1.000
  assert.equal(text(it, "pc"), "52% of 1000 Mbit/s");
});

test("a configured footer always wins over the translation", async () => {
  const it = await makeCard({ ...BASE, footer: "mia scritta {pct}" }, withLang("it", states()));
  assert.equal(text(it, "pc"), "mia scritta 52");
});

test("decimal separators follow the language", async () => {
  const en = await makeCard(BASE, withLang("en", states()));
  const it = await makeCard(BASE, withLang("it", states()));
  assert.equal(text(en, "p"), "5.3 ms");
  assert.equal(text(it, "p"), "5,3 ms");
});

test("a regional locale falls back to its base language", async () => {
  const el = await makeCard(BASE, withLang("it-CH", states("unknown")));
  assert.equal(text(el, "ag"), "mai");
});

test("an unknown language falls back to english", async () => {
  const el = await makeCard(BASE, withLang("xx", states("unknown")));
  assert.equal(text(el, "ag"), "never");
});

test("hass.language is honoured when locale is absent", async () => {
  const hass = { ...fakeHass(states("unknown")), language: "it" };
  const el = await makeCard(BASE, hass);
  assert.equal(text(el, "ag"), "mai");
});
