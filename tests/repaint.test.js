import test from "node:test";
import assert from "node:assert/strict";
import { makeCard, fakeHass, sensor, minutesAgo, text } from "./helpers.js";

const CFG = {
  type: "custom:speedtest-compact-card",
  down: "sensor.down", up: "sensor.up", last: "sensor.last",
  max_down: 1000, ok_pct: 80, warn_pct: 60
};

/** Home Assistant hands out immutable state objects, so identity is the signal. */
function hassWith(states) {
  return { ...fakeHass(states), locale: { language: "en" } };
}

function spy(el) {
  const calls = { n: 0 };
  const orig = el._paint.bind(el);
  el._paint = () => { calls.n++; orig() };
  return calls;
}

test("an unrelated state change does not repaint the card", async () => {
  const mine = {
    "sensor.down": sensor(519), "sensor.up": sensor(206), "sensor.last": sensor(minutesAgo(5))
  };
  const el = await makeCard(CFG, hassWith({ ...mine, "light.kitchen": sensor("off") }));
  const calls = spy(el);

  // Same state objects for our entities, a different one for somebody else's.
  el.hass = hassWith({ ...mine, "light.kitchen": sensor("on") });
  assert.equal(calls.n, 0, "a light turning on must not redraw a speedtest card");
});

test("a change on one of our entities does repaint", async () => {
  const mine = {
    "sensor.down": sensor(519), "sensor.up": sensor(206), "sensor.last": sensor(minutesAgo(5))
  };
  const el = await makeCard(CFG, hassWith(mine));
  const calls = spy(el);

  el.hass = hassWith({ ...mine, "sensor.down": sensor(742) });
  assert.equal(calls.n, 1);
  assert.equal(text(el, "d"), "742");
});

test("switching language repaints even with identical states", async () => {
  const mine = { "sensor.down": sensor(519), "sensor.last": sensor(minutesAgo(5)) };
  const el = await makeCard(CFG, hassWith(mine));
  const calls = spy(el);

  el.hass = { ...fakeHass(mine), locale: { language: "it" } };
  assert.equal(calls.n, 1);
});

test("the age keeps ticking on its own while connected", async () => {
  const el = await makeCard(CFG, hassWith({ "sensor.down": sensor(519), "sensor.last": sensor(minutesAgo(5)) }));
  document.body.appendChild(el);
  assert.ok(el._tick, "a timer must refresh the age without hass updates");
  el.remove();
  assert.equal(el._tick, null, "and must be cleared when the card leaves the page");
});
