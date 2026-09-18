import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, mock, test } from "node:test";
import { BrowserQuest } from "../js/game.js";

const root = new URL("../", import.meta.url);

class Element extends EventTarget {
  constructor() {
    super();
    this.children = [];
    this.style = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  getContext() {
    return {
      drawImage() {},
      getImageData() { return { data: new Uint8ClampedArray(4) }; },
      putImageData() {},
    };
  }
}

function createGame() {
  const elements = new Map();
  mock.method(globalThis, "setTimeout", () => 0);
  mock.method(globalThis, "clearTimeout", () => {});
  globalThis.innerWidth = 1024;
  globalThis.innerHeight = 768;
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    createElement() { return new Element(); },
  };
  const game = new BrowserQuest();
  game.world = { map: { width: 50, height: 250 }, blocked: new Set(), doors: new Map() };
  game.bindBridge();
  game.recalculateHealth(true);
  return game;
}

afterEach(() => {
  mock.restoreAll();
  delete globalThis.document;
  delete globalThis.innerWidth;
  delete globalThis.innerHeight;
  delete globalThis.Image;
  delete globalThis.window;
  delete globalThis.requestAnimationFrame;
});

test("startup loads the world and all required sprites from the checkout", async () => {
  const game = createGame();
  globalThis.window = {};
  globalThis.requestAnimationFrame = mock.fn();
  mock.method(game, "showStartScreen", async () => {});
  mock.method(game, "resize", () => {});
  mock.method(game, "setupEvents", () => {});
  mock.method(globalThis, "fetch", async (path) => {
    const data = await readFile(new URL(path, root), "utf8");
    return { ok: true, json: async () => JSON.parse(data) };
  });
  globalThis.Image = class {
    set src(path) {
      const png = readFileSync(new URL(path, root));
      assert.equal(png.toString("ascii", 1, 4), "PNG");
      this.naturalWidth = this.width = png.readUInt32BE(16);
      this.naturalHeight = this.height = png.readUInt32BE(20);
      this.complete = true;
    }
  };
  await game.init();
  assert.ok(game.bank.has(game.player.armor));
  assert.ok(game.bank.has(game.player.weapon));
  assert.ok(game.entities.length > 0);
  for (const entity of game.entities) {
    assert.ok(game.bank.has(entity.category === "item" ? `item-${entity.kind}` : entity.kind));
  }
  assert.ok(game.tileset.naturalWidth > 0);
  assert.equal(globalThis.requestAnimationFrame.mock.callCount(), 1);
});

test("all local HTML assets exist", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  const paths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1]).filter((path) => !path.includes("://"));
  const missing = paths.filter((path) => {
    try { accessSync(new URL(path, root)); return false; } catch { return true; }
  });
  assert.deepEqual(missing, []);
});

test("sound effects use existing audio files", () => {
  const game = createGame();
  game.soundEnabled = true;
  globalThis.Audio = class {
    constructor(path) { accessSync(new URL(path, root)); }
    play() { return Promise.resolve(); }
  };
  try {
    game.play("loot");
    assert.ok(game.audio.has("loot"));
  } finally {
    delete globalThis.Audio;
  }
});

for (const classId of ["warrior", "ranger", "mage"]) {
  test(`${classId} restores exact saved health, stats, and zero coins`, () => {
    const source = createGame();
    Object.assign(source.player, { classId, level: 8, vitality: 14, armor: "platearmor", coins: 0 });
    source.recalculateHealth(true);
    source.player.hp -= 47;
    const state = source.captureSaveState();
    const restored = createGame();
    assert.equal(restored.applySaveState(state), true);
    assert.equal(restored.player.hp, source.player.hp);
    assert.equal(restored.player.maxHp, source.player.maxHp);
    assert.equal(restored.player.coins, 0);
  });
}

test("restoring a dead character preserves zero health", () => {
  const game = createGame();
  const saved = { ...game.captureSaveState(), hp: 0, alive: false };
  game.applySaveState(saved);
  assert.equal(game.player.hp, 0);
  assert.equal(game.player.alive, false);
});

test("a respawned mob loses health across consecutive attacks", () => {
  const game = createGame();
  const mob = { id: "goblin-test", kind: "goblin", category: "mob", x: 19, y: 211 };
  game.setShared("mobs", mob.id, { hp: 0, defeatedUntil: Date.now() - 1000 });
  game.attackMob(mob);
  const firstHp = game.getMobState(mob).hp;
  assert.ok(firstHp > 0 && firstHp < 90, `remaining HP: ${firstHp}`);
  game.nextAttackAt = 0;
  game.attackMob(mob);
  assert.ok(game.getMobState(mob).hp < firstHp);
});

test("dropped items render using a finite animation frame", () => {
  const game = createGame();
  const draw = mock.method(game.bank, "draw", () => {});
  game.drawEntity({ id: "drop", kind: "flask", category: "loot", x: 1, y: 1 }, 1000);
  assert.equal(draw.mock.callCount(), 1);
  assert.ok(Number.isFinite(draw.mock.calls[0].arguments[3]));
});

test("an inventory flask heals once and is removed", () => {
  const game = createGame();
  game.player.hp = 50;
  game.renderInventory();
  const list = document.querySelector("#inventory-list");
  const entry = list.children.find((child) => child.children[0]?.textContent === "Healing flask");
  assert.equal(entry.children[1].textContent, "Use");
  entry.children[1].dispatchEvent(new Event("click"));
  assert.equal(game.player.hp, 75);
  assert.equal(game.player.inventory.includes("flask"), false);
  entry.children[1].dispatchEvent(new Event("click"));
  assert.equal(game.player.hp, 75);
});

test("auto-consumed world food does not remain in inventory", () => {
  const game = createGame();
  game.player.hp = 50;
  game.applyItem("burger");
  assert.equal(game.player.hp, 85);
  assert.equal(game.player.inventory.includes("burger"), false);
});

test("buying equipment refreshes inventory immediately", () => {
  const game = createGame();
  game.renderShopList();
  game.buyShopItem(game.shopItems[0]);
  assert.equal(game.player.coins, 80);
  assert.equal(game.player.weapon, "sword2");
  const entries = document.querySelector("#inventory-list").children;
  const sword = entries.find((entry) => entry.children[0]?.textContent === "Broad sword");
  assert.ok(sword);
  assert.equal(sword.children[1].textContent, "Equipped");
});

test("save feedback never describes a local fallback as a cloud save", async () => {
  const game = createGame();
  game.bridge.identity.id = "player-test";
  const storage = new Map();
  globalThis.localStorage = {
    setItem(key, value) { storage.set(key, value); },
  };
  try {
    await game.saveGame(true);
    assert.equal(document.querySelector("#toast").textContent, "Game saved on this device");
    assert.ok(storage.size > 0);
  } finally {
    delete globalThis.localStorage;
  }
});

test("blocked storage without a cloud connection reports a failed save", async () => {
  const game = createGame();
  mock.method(console, "warn", () => {});
  globalThis.localStorage = {
    setItem() { throw new Error("Storage is disabled"); },
  };
  try {
    await game.saveGame(true);
    assert.equal(document.querySelector("#toast").textContent, "Could not save progress");
    assert.equal(game.saveDirty, true);
  } finally {
    delete globalThis.localStorage;
  }
});

test("a successful cloud save still works when device storage is blocked", async () => {
  const game = createGame();
  game.bridge.identity.id = "player-test";
  const writes = [];
  game.bridge.room = {
    collection() { return { async upsert(state) { writes.push(state); } }; },
  };
  globalThis.localStorage = {
    setItem() { throw new Error("Storage is disabled"); },
  };
  try {
    assert.equal(await game.saveGame(true), true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].hp, game.player.hp);
    assert.equal(document.querySelector("#toast").textContent, "Game saved to your Websim profile");
  } finally {
    delete globalThis.localStorage;
  }
});

test("a failed cloud save reports its local fallback accurately", async () => {
  const game = createGame();
  mock.method(console, "warn", () => {});
  game.bridge.identity.id = "player-test";
  game.bridge.room = {
    collection() { return { async upsert() { throw new Error("Offline"); } }; },
  };
  const writes = [];
  globalThis.localStorage = { setItem(key, value) { writes.push([key, value]); } };
  try {
    assert.equal(await game.saveGame(true), false);
    assert.ok(writes.length > 0);
    assert.equal(document.querySelector("#toast").textContent, "Game saved on this device");
  } finally {
    delete globalThis.localStorage;
  }
});
