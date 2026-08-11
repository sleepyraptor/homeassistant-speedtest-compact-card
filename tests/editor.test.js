import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers.js";

async function makeEditor(config = {}) {
  await boot();
  const ed = document.createElement("speedtest-compact-card-editor");
  ed.hass = { states: {} };
  ed.setConfig(config);
  return ed;
}

const walk = (schema, out = []) => {
  for (const node of schema) {
    out.push(node);
    if (node.schema) walk(node.schema, out);
  }
  return out;
};

test("every group is unnamed so the values stay flat", async () => {
  // Regression: a named grid or expandable makes ha-form nest its children under
  // that name, so edits land in config.ent.down instead of config.down.
  const ed = await makeEditor({ down: "sensor.down" });
  const groups = walk(ed._f.schema).filter(n => n.type === "grid" || n.type === "expandable");
  assert.ok(groups.length > 0, "the schema should have groups");
  for (const g of groups) assert.equal(g.name, "", `group ${g.title || g.type} must have an empty name`);
});

test("download and upload share a row, ping and last test share the next", async () => {
  const ed = await makeEditor({ down: "sensor.down" });
  const entities = ed._f.schema.find(n => n.title === "Entities");
  const rows = entities.schema.filter(n => n.type === "grid").map(g => g.schema.map(f => f.name));
  assert.deepEqual(rows[0], ["down", "up"]);
  assert.deepEqual(rows[1], ["ping", "last"]);
});

test("the download field is marked required", async () => {
  const ed = await makeEditor({ down: "sensor.down" });
  const down = walk(ed._f.schema).find(n => n.name === "down");
  assert.equal(down.required, true);
});

test("every leaf field has a human label", async () => {
  const ed = await makeEditor({ down: "sensor.down" });
  const leaves = walk(ed._f.schema).filter(n => n.selector);
  for (const f of leaves) {
    const label = ed._f.computeLabel(f);
    assert.notEqual(label, f.name, `field ${f.name} falls back to its raw key`);
  }
});

test("the form is fed the config verbatim, without the card type", async () => {
  const ed = await makeEditor({ type: "custom:speedtest-compact-card", down: "sensor.down", ok_pct: 80 });
  assert.equal(ed._f.data.type, undefined);
  assert.equal(ed._f.data.down, "sensor.down");
  assert.equal(ed._f.data.ok_pct, 80);
  assert.equal(Object.keys(ed._f.data).length, 2, "no invented defaults in the form");
});

test("editing a field emits the whole config with the type restored", async () => {
  const ed = await makeEditor({ down: "sensor.down" });
  let emitted = null;
  ed.addEventListener("config-changed", e => { emitted = e.detail.config });
  ed._f.dispatchEvent(new CustomEvent("value-changed", {
    detail: { value: { down: "sensor.other", ok_pct: 80 } }
  }));
  assert.equal(emitted.type, "custom:speedtest-compact-card");
  assert.equal(emitted.down, "sensor.other");
  assert.equal(emitted.ok_pct, 80);
});
