import test from "node:test";
import assert from "node:assert/strict";
import { boot, makeCard, fakeHass, sensor, minutesAgo, $, text, hidden } from "./helpers.js";

const ENTS = {
  down: "sensor.down", up: "sensor.up", ping: "sensor.ping", last: "sensor.last"
};
const FULL = {
  type: "custom:speedtest-compact-card",
  ...ENTS,
  max_down: 1000, ok_pct: 80, warn_pct: 60,
  footer: "{pct}% of {max} {unit}",
  sparkline: true, days: 7, stale_hours: 2
};
const states = (down, opts = {}) => ({
  "sensor.down": sensor(down),
  "sensor.up": sensor(opts.up ?? 206.59),
  "sensor.ping": sensor(opts.ping ?? 5.26),
  "sensor.last": sensor(opts.last ?? minutesAgo(12))
});

test("setConfig rejects a config without the download entity", async () => {
  await boot();
  const el = document.createElement("speedtest-compact-card");
  assert.throws(() => el.setConfig({ type: "custom:speedtest-compact-card" }), /Missing download entity/);
  assert.throws(() => el.setConfig({ up: "sensor.up" }), /Missing download entity/);
});

test("renders the rounded figures and the configured labels", async () => {
  const el = await makeCard({ ...FULL, label_down: "Giu", unit: "Mbit/s", unit_ping: "ms" },
    fakeHass(states(519.83)));
  assert.equal(text(el, "d"), "520");
  assert.equal(text(el, "u"), "207");
  assert.equal(text(el, "p"), "5.3 ms");
  assert.equal(text(el, "ld"), "Giu");
  assert.equal(text(el, "un"), "Mbit/s");
});

test("shows a dash when an entity is missing from hass", async () => {
  const el = await makeCard(FULL, fakeHass({ "sensor.down": sensor("unavailable") }));
  assert.equal(text(el, "d"), "-");
  assert.equal(text(el, "u"), "-");
});

test("bar width is the share of the line, not the absolute value", async () => {
  const el = await makeCard(FULL, fakeHass(states(500)));
  assert.equal($(el, "f").style.width, "50.0%");
  assert.equal(text(el, "pc"), "50% of 1,000 Mbit/s");
});

test("bar is clamped at 100% when the line is exceeded", async () => {
  const el = await makeCard(FULL, fakeHass(states(1200)));
  assert.equal($(el, "f").style.width, "100.0%");
  assert.equal(text(el, "pc"), "100% of 1,000 Mbit/s");
});

test("colour follows the thresholds", async () => {
  const green = await makeCard(FULL, fakeHass(states(850)));
  const amber = await makeCard(FULL, fakeHass(states(700)));
  const red = await makeCard(FULL, fakeHass(states(400)));
  assert.match($(green, "f").style.background, /success-color/);
  assert.match($(amber, "f").style.background, /warning-color/);
  assert.match($(red, "f").style.background, /error-color/);
});

test("thresholds are inclusive at their own value", async () => {
  const onOk = await makeCard(FULL, fakeHass(states(800)));
  const onWarn = await makeCard(FULL, fakeHass(states(600)));
  assert.match($(onOk, "f").style.background, /success-color/);
  assert.match($(onWarn, "f").style.background, /warning-color/);
});

test("without max_down the bar and the percentage disappear", async () => {
  const cfg = { ...FULL };
  delete cfg.max_down;
  const el = await makeCard(cfg, fakeHass(states(519)));
  assert.ok(hidden(el, "ba"));
  assert.equal(text(el, "pc"), "");
});

test("optional entity blocks are not drawn when unset", async () => {
  const el = await makeCard({ type: "custom:speedtest-compact-card", down: ENTS.down },
    fakeHass(states(519)));
  assert.ok(hidden(el, "bu"), "upload block should be hidden");
  assert.ok(hidden(el, "bp"), "ping block should be hidden");
});

test("footer placeholders are all substituted", async () => {
  const el = await makeCard({ ...FULL, footer: "{pct} / {max} / {unit}", unit: "Mb" },
    fakeHass(states(250)));
  assert.equal(text(el, "pc"), "25 / 1,000 / Mb");
});

test("a fresh measurement is not flagged stale", async () => {
  const el = await makeCard(FULL, fakeHass(states(519, { last: minutesAgo(12) })));
  assert.match(text(el, "ag"), /12\b.*(minute|min)/);
  assert.equal($(el, "ag").className, "");
});

test("an old measurement is flagged stale and switches to hours", async () => {
  const el = await makeCard(FULL, fakeHass(states(519, { last: minutesAgo(300) })));
  assert.match(text(el, "ag"), /\b5\b.*(hour|h)/);
  assert.equal($(el, "ag").className, "stale");
});

test("an unparsable timestamp reads never and is stale", async () => {
  const el = await makeCard(FULL, fakeHass(states(519, { last: "unknown" })));
  assert.equal(text(el, "ag"), "never");
  assert.equal($(el, "ag").className, "stale");
});

test("without stale_hours the age is shown but never flagged", async () => {
  const cfg = { ...FULL };
  delete cfg.stale_hours;
  const el = await makeCard(cfg, fakeHass(states(519, { last: minutesAgo(5000) })));
  assert.equal($(el, "ag").className, "");
});

test("the graph reserves no space when disabled", async () => {
  const on = await makeCard(FULL, fakeHass(states(519), [400, 500, 600]));
  const off = await makeCard({ ...FULL, sparkline: false }, fakeHass(states(519)));
  assert.equal(hidden(on, "sp"), false);
  assert.ok(hidden(off, "sp"));
});

test("the sparkline draws a polyline from history", async () => {
  const el = await makeCard(FULL, fakeHass(states(519), [400, 500, 450, 600]));
  await new Promise(r => setTimeout(r, 0));
  assert.match($(el, "sp").innerHTML, /<polyline/);
  assert.match($(el, "sp").innerHTML, /<polygon/);
});

test("a single history point draws nothing rather than a broken line", async () => {
  const el = await makeCard(FULL, fakeHass(states(519), [400]));
  await new Promise(r => setTimeout(r, 0));
  assert.equal($(el, "sp").innerHTML, "");
});

test("card size and grid options shrink when the graph is off", async () => {
  const on = await makeCard(FULL, fakeHass(states(519)));
  const off = await makeCard({ ...FULL, sparkline: false }, fakeHass(states(519)));
  assert.equal(on.getCardSize(), 3);
  assert.equal(off.getCardSize(), 2);
  assert.equal(on.getGridOptions().rows, 3);
  assert.equal(off.getGridOptions().rows, 2);
  assert.equal(off.getGridOptions().min_rows, 1);
});

test("a config change repaints an already rendered card", async () => {
  const el = await makeCard(FULL, fakeHass(states(519)));
  assert.equal(text(el, "d"), "519");
  el.setConfig({ ...FULL, down: "sensor.up" });
  assert.equal(text(el, "d"), "207", "the card must follow the new entity");
});

test("stub config ships the 80/60 thresholds", async () => {
  await boot();
  const stub = customElements.get("speedtest-compact-card").getStubConfig();
  assert.equal(stub.ok_pct, 80);
  assert.equal(stub.warn_pct, 60);
  assert.equal(stub.type, "custom:speedtest-compact-card");
});
