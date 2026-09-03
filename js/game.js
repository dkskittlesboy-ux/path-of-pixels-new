import { MultiplayerBridge } from "./multiplayer.js";
import {
  TILE,
  SpriteBank,
  ChunkManager,
  drawWorldTiles,
  findPath,
  isWalkable,
  loadWorld,
  nearestWalkable,
  tileIndexToGrid,
} from "./world.js";



const MOBS = new Set(["rat", "skeleton", "goblin", "ogre", "spectre", "crab", "bat", "wizard", "eye", "snake", "skeleton2", "boss", "deathknight", "sylvan"]);
const NPCS = new Set(["guard", "king", "octocat", "villagegirl", "villager", "priest", "scientist", "agent", "rick", "nyan", "sorcerer", "beachnpc", "forestnpc", "desertnpc", "lavanpc", "coder"]);
const WEAPONS = ["sword1", "sword2", "axe", "morningstar", "bluesword", "redsword", "goldensword"];
const ARMORS = ["clotharmor", "leatherarmor", "mailarmor", "platearmor", "redarmor", "goldenarmor"];
const CONSUMABLES = new Set(["flask", "burger", "firepotion", "cake"]);
const ITEM_KINDS = new Set([...WEAPONS, ...ARMORS, ...CONSUMABLES]);
const MOB_HP = { rat: 25, crab: 60, bat: 80, goblin: 90, wizard: 100, skeleton: 110, snake: 150, ogre: 200, eye: 200, skeleton2: 200, spectre: 250, deathknight: 250, boss: 700, sylvan: 1200 };
const MOB_DAMAGE = { rat: 4, crab: 5, bat: 5, goblin: 7, wizard: 9, skeleton: 8, snake: 10, ogre: 12, eye: 12, skeleton2: 13, spectre: 14, deathknight: 15, boss: 22, sylvan: 28 };
const MOB_NAMES = { sylvan: "Sylvan Hulk" };
const VILLAGE_HOUSE_MOBS = [
  { door: [27, 209], kind: "rat", spots: [[0, -1], [1, -1]] },
  { door: [51, 205], kind: "goblin", spots: [[0, -1], [1, -1]] },
  { door: [77, 206], kind: "rat", spots: [[0, -1], [1, -1]] },
  { door: [80, 211], kind: "goblin", spots: [[0, -1], [1, -1]] },
];
const DROP_TABLES = {
  rat: ["flask", "flask", "burger", "sword2"],
  crab: ["flask", "axe", "leatherarmor"],
  bat: ["flask", "axe", "firepotion"],
  goblin: ["flask", "leatherarmor", "axe", "firepotion"],
  skeleton: ["flask", "mailarmor", "axe", "firepotion"],
  snake: ["flask", "mailarmor", "morningstar"],
  ogre: ["burger", "platearmor", "morningstar", "firepotion"],
  wizard: ["flask", "platearmor", "firepotion"],
  eye: ["flask", "redarmor", "redsword"],
  skeleton2: ["flask", "platearmor", "bluesword"],
  spectre: ["flask", "redarmor", "redsword"],
  deathknight: ["burger", "burger", "firepotion"],
  boss: ["goldensword"],
  sylvan: ["goldensword", "firepotion", "platearmor"],
};

const NPC_LINES = {
  guard: "Keep your hand on your hilt, traveller. Past those gates, the world forgets its manners.",
  king: "The crown requires the strength of true heroes. Will you answer the realm's call?",
  octocat: "Branch out and fork boldly, adventurer. May your commits be clean.",
  villagegirl: "Keep your eyes on the ditches! Travellers often drop perfectly good supplies along the road.",
  villager: "The beasts always crawl back... but luckily, so do heroes like you.",
  priest: "A full belly and a blessed flask will patch up those wounds in no time. Stay strong.",
  scientist: "In theory, shattering a fire potion over your blade makes it exponentially more lethal. Go try it!",
  agent: "Take a closer look at the other travellers. They aren't illusions—they're real Websim players.",
  sorcerer: "Deep within the caverns lie weapons of immense power... and the horrors that guard them.",
  beachnpc: "Don't let those crabs fool you with their little dances. They will snip you in half.",
  coder: "Fascinating, isn't it? This entire realm continues to hum along, even after the old server died.",
  default: "May the wind be at your back, adventurer.",
};

const LABELS = {
  clotharmor: "Cloth", leatherarmor: "Leather", mailarmor: "Mail", platearmor: "Plate", redarmor: "Ruby armor", goldenarmor: "Golden armor",
  sword1: "Training sword", sword2: "Broad sword", axe: "Axe", morningstar: "Morning star", bluesword: "Blue sword", redsword: "Ruby sword", goldensword: "Golden sword",
  flask: "Healing flask", burger: "Burger", firepotion: "Fire potion", cake: "Cake",
};
const AUTO_SAVE_INTERVAL = 5000;
const SAVE_VERSION = 1;
const JUMP_DURATION = 420;
const MAX_JUMPS = 2;
const MAX_LEVEL = 50;
const CHAT_FILTER = /(?:\b(?:kill|hate|stupid|idiot|shut\s*up)\b|https?:\/\/|www\.)/gi;
const RANDOM_NAMES = ["Pixel Knight", "Moss Walker", "Star Scout", "Rune Fox", "Dawn Blade", "Cave Runner", "Tiny Titan", "Moon Miner"];
const RPG_CLASSES = {
  warrior: { label: "Warrior", bonus: "health", baseHp: 120, power: 1.2 },
  ranger: { label: "Ranger", bonus: "critical", baseHp: 100, power: 1.1 },
  mage: { label: "Mage", bonus: "spell", baseHp: 90, power: 1.35 },
};
const LEVEL_TREE = {
  warrior: ["Iron skin", "Heavy swing", "Last stand"],
  ranger: ["Keen eye", "Quick step", "Volley"],
  mage: ["Mana well", "Arcane spark", "Meteor"],
};

class BrowserQuest {
  constructor() {
    this.canvas = document.querySelector("#game");
    this.ctx = this.canvas.getContext("2d");
    this.bridge = new MultiplayerBridge();
    this.bank = new SpriteBank();
    this.world = null;
    this.tileset = null;
      this.chunkManager = null;
    this.entities = [];
    this.entityById = new Map();
    this.remotePresence = {};
    this.peers = {};
    this.roomState = {};
    this.path = [];
    this.pendingInteraction = null;
    this.combatTarget = null;
    this.keys = new Set();
    this.joystickDir = null; // 'up'|'down'|'left'|'right' when using joystick
    this.controlMode = "joystick";
    this.camera = { x: 0, y: 0 };
    this.viewport = { width: innerWidth, height: innerHeight };
    this.scale = this.chooseScale();
    this.lastFrame = performance.now();
    this.nextStepAt = 0;
    this.nextAttackAt = 0;
    this.nextMobHitAt = 0;
    this.jumpCount = 0;
    this.jumpStartedAt = 0;
    this.jumpUntil = 0;
    this.lastPresenceAt = 0;
    this.attackUntil = 0;
    this.fireBuffUntil = 0;
    this.toastTimer = 0;
    this.soundEnabled = false;
    this.audio = new Map();
    this.mapTerrain = null;
    this.lastMapDraw = 0;
    this.mapZoom = 1;
    this.mapFitZoom = 1;
    this.playerMapColors = new Map();
    this.saveDirty = false;
    this.saveInFlight = null;
    this.lastAutoSaveAt = Date.now();
    this.saveFeedbackTimer = 0;
    this.respawning = false;
    this.stealthUntil = 0;
    this.pvpEnabled = false;
    this.attackStartedAt = 0;

    // Water flow overlay canvas (subtle, animated overlay to simulate flowing water)
    this.waterCanvas = null;
    this.waterCtx = null;
    this.waterFlowPhase = 0;
    this.waterOverlayAlpha = 0.14;
    this.ambientAudio = null;
    this.ambientNodes = null;

    // Shop / economy: seed coins for player and list of purchasable items
    this.shopItems = [
      { id: "sword2", label: "Broad sword", price: 40, damage: 18 },
      { id: "axe", label: "Axe", price: 65, damage: 25 },
      { id: "morningstar", label: "Morning star", price: 100, damage: 34 },
      { id: "bluesword", label: "Blue sword", price: 160, damage: 46 },
      { id: "goldensword", label: "Golden sword", price: 300, damage: 62 }
    ];

    this.player = { x: 18, y: 211, rx: 18, ry: 211, dir: "down", hp: 120, maxHp: 120, armor: "clotharmor", weapon: "sword1", alive: true, chat: "", chatAt: 0, coins: 120, classId: "warrior", level: 1, xp: 0, skillPoints: 0, skills: [], inventory: ["clotharmor", "sword1", "flask"], strength: 10, intellect: 10, vitality: 10, dexterity: 10 };
  }

  async init() {
    this.bindBridge();
    const identityPromise = this.bridge.getIdentity();
    this.world = await loadWorld();
    this.buildEntities();

    const spriteNames = new Set(["shadow16", "clotharmor", "leatherarmor", "mailarmor", "platearmor", "redarmor", "goldenarmor", ...WEAPONS, "chest"]);
    for (const entity of this.entities) {
      spriteNames.add(entity.category === "item" ? `item-${entity.kind}` : entity.kind);
    }
    for (const kind of ITEM_KINDS) spriteNames.add(`item-${kind}`);

    this.tileset = new Image();
    this.tileset.src = "assets/img/tilesheet.png";
    const tilesetReady = waitForImage(this.tileset, "tilesheet");
    await Promise.all([tilesetReady, this.bank.load(spriteNames)]);
  this.chunkManager = new ChunkManager(this.world, this.tileset);

    const identity = await identityPromise;
    await this.showStartScreen(identity);
    const localSave = this.readLocalSave(identity);
    if (localSave) this.applySaveState(localSave);
    document.querySelector("#player-name").textContent = `@${identity.username}`;
    if (identity.avatarUrl) {
      const avatar = document.querySelector("#player-avatar");
      avatar.src = identity.avatarUrl;
      avatar.classList.add("user-avatar");
    }

    this.resize();
    this.setupEvents();
    this.updateHud();
    await this.bridge.connect(this.presenceSnapshot());
    const cloudSave = await this.bridge.loadGameState(identity.id);
    const restoredSave = newestSave(localSave, cloudSave);
    if (restoredSave && restoredSave !== localSave) {
      this.applySaveState(restoredSave);
      this.writeLocalSave(restoredSave);
    }
    this.publish(true);
    document.querySelector("#loading").classList.add("done");
    if (restoredSave) {
      this.showToast("Welcome back · progress restored");
      if (this.player.alive === false) this.resumeSavedDeath();
    } else {
      this.showToast(this.bridge.online ? "Joined the shared realm" : "Preview realm · multiplayer activates when published");
    }
    this.lastAutoSaveAt = Date.now();
    this.saveDirty = !restoredSave || Boolean(localSave && (!cloudSave || Number(localSave.savedAt) > Number(cloudSave.savedAt)));
    requestAnimationFrame((time) => this.loop(time));
  }

  async showStartScreen(identity) {
    const loadingScreen = document.querySelector("#loading-screen");
    const startScreen = document.querySelector("#start-screen");
    const safetyGate = document.querySelector("#safety-gate");
    const controlChoice = document.querySelector("#control-choice");
    const proceed = document.querySelector("#proceed-button");
    const dontProceed = document.querySelector("#dont-proceed-button");
    const loadingStatus = document.querySelector("#loading-status");
    await new Promise((resolve) => setTimeout(resolve, 850));
    loadingScreen.hidden = true;
    startScreen.classList.add("visible");
    await new Promise((resolve) => {
      proceed.addEventListener("click", () => {
        this.controlMode = document.querySelector("input[name='controlMode']:checked")?.value || "joystick";
        safetyGate.hidden = true;
        document.querySelector("#start-form").hidden = false;
        loadingStatus.textContent = "Choose your adventurer";
        resolve();
      }, { once: true });
      dontProceed.addEventListener("click", () => {
        loadingStatus.textContent = "You can return whenever you are ready.";
        dontProceed.disabled = true;
      });
    });

    const input = document.querySelector("#player-name-input");
    const form = document.querySelector("#start-form");
    const play = document.querySelector("#play-button");
    const random = document.querySelector("#random-name");
    const quit = document.querySelector("#quit-button");
    const error = document.querySelector("#name-error");
    const classSelect = document.querySelector("#class-select");
    let savedName = "";
    try { savedName = localStorage.getItem("browserquest:player-name") || ""; } catch { /* Use the identity when storage is unavailable. */ }
    input.value = savedName || identity.username || "";
    const updatePlayState = () => { play.disabled = input.value.trim().length < 2; };
    const chooseRandomName = () => {
      input.value = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
      error.textContent = "";
      updatePlayState();
      input.focus();
      input.select();
    };
    random.addEventListener("click", chooseRandomName);
    input.addEventListener("input", () => { error.textContent = ""; updatePlayState(); });
    quit.addEventListener("click", () => {
      input.value = "";
      error.textContent = "Enter a name to begin your journey.";
      updatePlayState();
      input.focus();
    });
    updatePlayState();

    await new Promise((resolve) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = input.value.trim().replace(/\s+/g, " ");
        if (name.length < 2) {
          error.textContent = "Your name needs at least 2 characters.";
          input.focus();
          return;
        }
        identity.username = name.slice(0, 18);
        this.player.classId = classSelect.value;
        this.player.level = 1;
        this.player.xp = 0;
        this.player.skillPoints = 0;
        this.player.skills = [];
        this.recalculateHealth(true);
        try { localStorage.setItem("browserquest:player-name", identity.username); } catch { /* The name still works for this session. */ }
        resolve();
      }, { once: true });
    });
    form.remove();
    document.querySelector("#loading").setAttribute("aria-busy", "false");
  }

  bindBridge() {
    this.bridge.onPresence = (presence, peers) => {
      this.remotePresence = presence || {};
      this.peers = peers || {};
      this.updatePlayerCount(Object.keys(this.peers).length || Object.keys(this.remotePresence).length || 1);
      if (document.querySelector("#map-modal")?.open) this.drawWorldMap();
    };
    this.bridge.onRoomState = (state) => { this.roomState = state || {}; };
    this.bridge.onStatus = ({ online, count }) => {
      const label = document.querySelector("#connection");
      label.textContent = online ? `${count} online` : "solo";
      label.classList.toggle("offline", !online);
      this.updatePlayerCount(count || 1);
    };
    this.bridge.onEvent = (event) => {
      if (event?.type === "attack" && event.mobId) {
        const mob = this.entityById.get(event.mobId);
        if (mob) mob.hurtUntil = performance.now() + 180;
        this.play("hit1");
      } else if (event?.type === "chat") {
        this.play("chat");
      } else if (event?.type === "loot") {
        this.play("loot");
      }
    };
  }

  buildEntities() {
    const width = this.world.server.width;
    for (const [index, kind] of Object.entries(this.world.server.staticEntities || {})) {
      const pos = tileIndexToGrid(index, width);
      const category = MOBS.has(kind) ? "mob" : NPCS.has(kind) ? "npc" : "item";
      this.addEntity({ id: `static-${index}`, kind, category, ...pos, spawnX: pos.x, spawnY: pos.y });
    }

    for (const area of this.world.server.roamingAreas || []) {
      for (let i = 0; i < area.nb; i++) {
        const innerW = Math.max(1, area.width - 2);
        const innerH = Math.max(1, area.height - 2);
        const rawX = area.x + 1 + ((area.id * 11 + i * 5) % innerW);
        const rawY = area.y + 1 + ((area.id * 7 + i * 3) % innerH);
        const pos = nearestWalkable(this.world, rawX, rawY);
        this.addEntity({ id: `roam-${area.id}-${i}`, kind: area.type, category: "mob", ...pos, spawnX: pos.x, spawnY: pos.y });
      }
    }

    for (const [index, [x, y]] of [[44, 57], [50, 57]].entries()) {
      const pos = nearestWalkable(this.world, x, y);
      this.addEntity({ id: `sylvan-hulk-${index}`, kind: "sylvan", category: "mob", ...pos, spawnX: pos.x, spawnY: pos.y });
    }

    for (const [houseIndex, house] of VILLAGE_HOUSE_MOBS.entries()) {
      const entrance = this.world.doors.get(`${house.door[0]},${house.door[1]}`);
      if (!entrance) continue;
      for (const [mobIndex, [offsetX, offsetY]] of house.spots.entries()) {
        const pos = nearestWalkable(this.world, entrance.tx + offsetX, entrance.ty + offsetY);
        this.addEntity({
          id: `village-house-${houseIndex}-${mobIndex}`,
          kind: house.kind,
          category: "mob",
          ...pos,
          spawnX: pos.x,
          spawnY: pos.y,
        });
      }
    }

    for (const [i, chest] of (this.world.server.staticChests || []).entries()) {
      this.addEntity({ id: `chest-${i}`, kind: "chest", category: "chest", x: chest.x, y: chest.y, spawnX: chest.x, spawnY: chest.y, chestItems: chest.i });
    }
  }

  addEntity(entity) {
    entity.phase = hashString(entity.id) % 1000;
    this.entities.push(entity);
    this.entityById.set(entity.id, entity);
  }

  localSaveKey(identity = this.bridge.identity) {
    return `browserquest:save:${identity.id || identity.username || "guest"}`;
  }

  readLocalSave(identity) {
    try {
      const fullSave = JSON.parse(localStorage.getItem(this.localSaveKey(identity)) || "null");
      if (fullSave) return fullSave;
      const legacy = JSON.parse(localStorage.getItem(`browserquest:${identity.username}`) || "null");
      if (legacy && ARMORS.includes(legacy.armor) && WEAPONS.includes(legacy.weapon)) {
        return { version: 0, savedAt: 0, x: 18, y: 211, dir: "down", hp: 100, armor: legacy.armor, weapon: legacy.weapon, alive: true };
      }
    } catch { /* A fresh character is always a valid fallback. */ }
    return null;
  }

  applySaveState(saved) {
    if (!saved || !ARMORS.includes(saved.armor) || !WEAPONS.includes(saved.weapon)) return false;
    const rawX = Number(saved.x), rawY = Number(saved.y);
    const position = Number.isFinite(rawX) && Number.isFinite(rawY)
      ? nearestWalkable(this.world, Math.round(rawX), Math.round(rawY))
      : nearestWalkable(this.world, 18, 211);
    const armor = saved.armor;
    const maxHp = 100 + Math.max(0, ARMORS.indexOf(armor)) * 18;
    Object.assign(this.player, {
      x: position.x,
      y: position.y,
      rx: position.x,
      ry: position.y,
      dir: ["up", "down", "left", "right"].includes(saved.dir) ? saved.dir : "down",
      armor,
      weapon: saved.weapon,
      maxHp,
      hp: Math.max(0, Math.min(maxHp, Number(saved.hp ?? maxHp))),
      alive: saved.alive !== false,
      respawnAt: Number(saved.respawnAt || 0),
      coins: Number(saved.coins || this.player.coins || 0),
      classId: RPG_CLASSES[saved.classId] ? saved.classId : "warrior",
      level: Math.max(1, Number(saved.level || 1)),
      xp: Math.max(0, Number(saved.xp || 0)),
      skillPoints: Math.max(0, Number(saved.skillPoints || 0)),
      skills: Array.isArray(saved.skills) ? saved.skills.filter((skill) => LEVEL_TREE[saved.classId || "warrior"]?.includes(skill)) : [],
      inventory: Array.isArray(saved.inventory) ? saved.inventory.filter((item) => ITEM_KINDS.has(item)) : [armor, saved.weapon],
      strength: Math.max(1, Number(saved.strength || 10)),
      intellect: Math.max(1, Number(saved.intellect || 10)),
      vitality: Math.max(1, Number(saved.vitality || 10)),
      dexterity: Math.max(1, Number(saved.dexterity || 10)),
    });
    this.recalculateHealth(false);
    const buffRemaining = Math.max(0, Math.min(10000, Number(saved.fireBuffRemaining || 0)));
    this.fireBuffUntil = performance.now() + buffRemaining;
    this.path = [];
    this.pendingInteraction = null;
    this.combatTarget = null;
    this.updateHud();
    return true;
  }

  captureSaveState() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      x: this.player.x,
      y: this.player.y,
      dir: this.player.dir,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      armor: this.player.armor,
      weapon: this.player.weapon,
      alive: this.player.alive,
      respawnAt: Number(this.player.respawnAt || 0),
      fireBuffRemaining: Math.max(0, Math.round(this.fireBuffUntil - performance.now())),
      coins: Number(this.player.coins || 0),
      classId: this.player.classId,
      level: this.player.level,
      xp: this.player.xp,
      skillPoints: this.player.skillPoints,
      skills: [...this.player.skills],
      inventory: [...this.player.inventory],
      strength: this.player.strength,
      intellect: this.player.intellect,
      vitality: this.player.vitality,
      dexterity: this.player.dexterity,
    };
  }

  writeLocalSave(state) {
    try {
      localStorage.setItem(this.localSaveKey(), JSON.stringify(state));
    } catch { /* Storage can be unavailable in private browsing. */ }
  }

  markSaveDirty() {
    this.saveDirty = true;
  }

  async saveGame(manual = false) {
    if (this.saveInFlight) {
      if (manual) {
        await this.saveInFlight;
        return this.saveGame(true);
      }
      return false;
    }
    const state = this.captureSaveState();
    this.writeLocalSave(state);
    this.saveDirty = false;
    this.lastAutoSaveAt = state.savedAt;
    const button = document.querySelector("#save-button");
    button?.classList.remove("saved", "failed");
    button?.classList.add("saving");

    const request = this.bridge.saveGameState(this.bridge.identity.id, state);
    this.saveInFlight = request;
    let cloudSaved = false;
    try {
      cloudSaved = await request;
      this.flashSaveButton("saved");
      if (manual) this.showToast(cloudSaved ? "Game saved to your Websim profile" : "Game saved on this device");
    } catch (error) {
      this.saveDirty = true;
      this.flashSaveButton("failed");
      if (manual) this.showToast("Could not save progress", 2600);
      console.warn("Save request failed; progress remains saved on this device.", error);
      return false;
    } finally {
      if (this.saveInFlight === request) this.saveInFlight = null;
    }
    return cloudSaved;
  }

  flashSaveButton(state) {
    const button = document.querySelector("#save-button");
    if (!button) return;
    button.classList.remove("saving", "saved", "failed");
    button.classList.add(state);
    clearTimeout(this.saveFeedbackTimer);
    this.saveFeedbackTimer = setTimeout(() => button.classList.remove(state), 1300);
  }

  resumeSavedDeath() {
    this.respawning = true;
    document.querySelector("#death-screen").hidden = false;
    const delay = Math.max(0, Number(this.player.respawnAt || 0) - Date.now());
    setTimeout(() => this.respawn(), Math.min(2800, delay));
  }

  setupEvents() {
    addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", (event) => this.handlePointer(event));
    // Initialize mobile joystick if available and on touch devices
    this.initJoystickIfMobile();
    addEventListener("keydown", (event) => {
      const chatOpen = document.querySelector("#chat-form").classList.contains("open");
      if (event.key === "Enter" && !chatOpen) {
        event.preventDefault();
        this.openChat();
        return;
      }
      if (event.key === "Escape" && chatOpen) {
        this.closeChat();
        return;
      }
      if (chatOpen) return;
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        event.preventDefault();
        this.keys.add(key);
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) this.doubleJump();
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        if (!event.repeat) this.activateStealth();
      }
    });
    addEventListener("keyup", (event) => this.keys.delete(event.key.toLowerCase()));

    document.querySelector("#chat-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector("#chat-input");
      const message = input.value.trim().slice(0, 90);
      if (message) {
        const cleanMessage = message.replace(CHAT_FILTER, "[filtered]").replace(/(.)\1{5,}/g, "$1$1$1").slice(0, 90);
        this.player.chat = cleanMessage;
        this.player.chatAt = Date.now();
        this.bridge.updatePresence({ chat: cleanMessage, chatAt: this.player.chatAt });
        this.bridge.send({ type: "chat", echo: true });
      }
      input.value = "";
      this.closeChat();
    });

    document.querySelector("#chat-button").addEventListener("click", () => {
      const chatOpen = document.querySelector("#chat-form").classList.contains("open");
      if (chatOpen) this.closeChat();
      else this.openChat();
    });

    document.querySelector("#sound-button").addEventListener("click", (event) => {
      this.soundEnabled = !this.soundEnabled;
      event.currentTarget.setAttribute("aria-pressed", String(this.soundEnabled));
      if (this.soundEnabled) {
        this.play("achievement");
        this.startAmbientAudio();
      } else this.stopAmbientAudio();
    });

    document.querySelector("#save-button").addEventListener("click", () => this.saveGame(true));
    const hud = document.querySelector("#player-card");
    const hudOpen = document.querySelector("#hud-open");
    const setHudVisible = (visible) => {
      hud.hidden = !visible;
      hudOpen.hidden = visible;
      try { localStorage.setItem("browserquest:hud-visible", visible ? "1" : "0"); } catch {}
    };
    document.querySelector("#hud-close").addEventListener("click", () => setHudVisible(false));
    hudOpen.addEventListener("click", () => setHudVisible(true));
    try {
      if (localStorage.getItem("browserquest:hud-visible") === "0") setHudVisible(false);
    } catch {}
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.saveGame(false);
    });
    addEventListener("pagehide", () => this.saveGame(false));

    const instructions = document.querySelector("#instructions-modal");
    const openInstructions = () => {
      if (!instructions.open) instructions.showModal();
    };
    const closeInstructions = () => instructions.close();
    document.querySelector("#info-button").addEventListener("click", openInstructions);
    document.querySelector("#hint-more").addEventListener("click", openInstructions);
    document.querySelector("#instructions-close").addEventListener("click", closeInstructions);
    document.querySelector("#instructions-done").addEventListener("click", closeInstructions);
    instructions.addEventListener("click", (event) => {
      if (event.target === instructions) closeInstructions();
    });

    const mobileHint = document.querySelector("#mobile-hint");
    try {
      if (localStorage.getItem("browserquest:hint-dismissed") === "1") mobileHint.classList.add("dismissed");
    } catch { /* The hint remains visible when storage is unavailable. */ }
    document.querySelector("#hint-close").addEventListener("click", () => {
      mobileHint.classList.add("dismissed");
      try { localStorage.setItem("browserquest:hint-dismissed", "1"); } catch { /* Nonessential preference. */ }
    });

    const mapModal = document.querySelector("#map-modal");
    const openMap = () => {
      if (!mapModal.open) mapModal.showModal();
      this.drawWorldMap();
      requestAnimationFrame(() => this.fitWorldMap());
    };
    const closeMap = () => mapModal.close();
    document.querySelector("#map-button").addEventListener("click", openMap);
    document.querySelector("#map-close").addEventListener("click", closeMap);
    document.querySelector("#map-zoom-me").addEventListener("click", () => this.zoomMapToPlayer());
    document.querySelector("#map-zoom-out").addEventListener("click", () => {
      const local = this.mapPlayers().find((player) => player.local);
      this.setMapZoom(Math.max(this.mapFitZoom, this.mapZoom - .6), local);
    });
    document.querySelector("#map-fit").addEventListener("click", () => this.fitWorldMap());
    document.querySelector("#map-frame").addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const next = this.mapZoom + (event.deltaY < 0 ? .4 : -.4);
      this.setMapZoom(next);
    }, { passive: false });
    mapModal.addEventListener("click", (event) => {
      if (event.target === mapModal) closeMap();
    });

    // Shop modal actions
    document.querySelector("#shop-button")?.addEventListener("click", () => this.openShop());
    document.querySelector("#inventory-button")?.addEventListener("click", () => this.openShop());
    document.querySelector("#pvp-button")?.addEventListener("click", (event) => {
      this.pvpEnabled = !this.pvpEnabled;
      event.currentTarget.setAttribute("aria-pressed", String(this.pvpEnabled));
      this.publish(true);
      this.showToast(this.pvpEnabled ? "PvP enabled" : "PvP disabled");
    });
    document.querySelectorAll("[data-hotbar-slot]").forEach((button) => {
      button.addEventListener("click", () => this.useHotbar(Number(button.dataset.hotbarSlot)));
    });
    document.querySelector("#shop-close")?.addEventListener("click", () => this.closeShop());
    document.querySelector("#shop-done")?.addEventListener("click", () => this.closeShop());
    document.querySelector("#shop-modal")?.addEventListener("click", (e) => { if (e.target === document.querySelector("#shop-modal")) this.closeShop(); });
    document.querySelector("#player-count")?.addEventListener("click", () => this.openPlayerInspect());
    document.querySelector("#player-inspect-close")?.addEventListener("click", () => document.querySelector("#player-inspect-modal")?.close());
    document.querySelectorAll("input[name='controlMode']").forEach((input) => input.addEventListener("change", () => this.setControlMode(input.value)));
    document.querySelectorAll("#dpad [data-direction]").forEach((button) => {
      const press = (event) => { event.preventDefault(); this.joystickDir = button.dataset.direction; };
      const release = () => { this.joystickDir = null; };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    });
    this.setControlMode(this.controlMode);
  }

  setControlMode(mode) {
    this.controlMode = mode === "dpad" ? "dpad" : "joystick";
    const joystick = document.querySelector("#joystick-zone");
    const dpad = document.querySelector("#dpad");
    if (joystick) joystick.hidden = this.controlMode === "dpad";
    if (dpad) dpad.hidden = this.controlMode !== "dpad";
  }

  updatePlayerCount(count) {
    const safeCount = Math.max(1, Number(count) || 1);
    const output = document.querySelector("#player-count");
    document.querySelector("#player-count-value").textContent = safeCount > 99 ? "99+" : String(safeCount);
    output.setAttribute("aria-label", `${safeCount} ${safeCount === 1 ? "player" : "players"} online`);
  }

  buildMapTerrain() {
    if (this.mapTerrain || !this.world || !this.tileset) return;
    const map = this.world.map;
    const pixelSize = 2;
    const terrain = document.createElement("canvas");
    terrain.width = map.width * pixelSize;
    terrain.height = map.height * pixelSize;
    const ctx = terrain.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const columns = this.tileset.width / TILE;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const value = map.data[y * map.width + x];
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (!Number.isFinite(id) || id < 1) continue;
          const source = id - 1;
          ctx.drawImage(this.tileset, (source % columns) * TILE, Math.floor(source / columns) * TILE, TILE, TILE,
            x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    this.mapTerrain = terrain;
  }

  setMapZoom(value, focusPlayer = null) {
    const canvas = document.querySelector("#world-map");
    const zoom = Math.max(this.mapFitZoom, Math.min(4, Number(value) || 1));
    this.mapZoom = Math.round(zoom * 10) / 10;
    canvas.style.width = `${canvas.width * this.mapZoom}px`;
    canvas.style.height = `${canvas.height * this.mapZoom}px`;
    document.querySelector("#map-zoom-level").textContent = `${this.mapZoom.toFixed(1).replace(".0", "")}×`;
    if (focusPlayer) requestAnimationFrame(() => this.focusMapAt(focusPlayer.x, focusPlayer.y));
  }

  fitWorldMap() {
    const frame = document.querySelector("#map-frame");
    const canvas = document.querySelector("#world-map");
    if (!frame.clientWidth || !canvas.width) return;
    this.mapFitZoom = Math.min((frame.clientWidth - 18) / canvas.width, (frame.clientHeight - 18) / canvas.height, 1);
    this.setMapZoom(this.mapFitZoom);
    requestAnimationFrame(() => {
      frame.scrollLeft = 0;
      frame.scrollTop = 0;
    });
  }

  zoomMapToPlayer() {
    const local = this.mapPlayers().find((player) => player.local);
    if (!local) return;
    const nextZoom = this.mapZoom < 1.8 ? 2.2 : Math.min(4, this.mapZoom + .6);
    this.setMapZoom(nextZoom, local);
  }

  focusMapAt(gridX, gridY) {
    const frame = document.querySelector("#map-frame");
    const markerX = Number(gridX) * 2 * this.mapZoom;
    const markerY = Number(gridY) * 2 * this.mapZoom;
    frame.scrollTo({
      left: Math.max(0, markerX - frame.clientWidth / 2),
      top: Math.max(0, markerY - frame.clientHeight / 2),
      behavior: "smooth",
    });
  }

  mapPlayers() {
    const players = [];
    let hasLocal = false;
    for (const [id, presence] of Object.entries(this.remotePresence || {})) {
      if (!presence || !Number.isFinite(Number(presence.x)) || !Number.isFinite(Number(presence.y))) continue;
      const local = id === this.bridge.clientId || (!this.bridge.online && id === "local");
      if (local) hasLocal = true;
      players.push({
        id,
        x: Number(presence.px ?? presence.x),
        y: Number(presence.py ?? presence.y),
        username: this.peers[id]?.username || presence.username || (local ? this.bridge.identity.username : "Adventurer"),
        local,
      });
    }
    if (!hasLocal) players.push({ id: this.bridge.clientId, x: this.player.rx, y: this.player.ry, username: this.bridge.identity.username, local: true });
    return players;
  }

  drawWorldMap() {
    this.buildMapTerrain();
    if (!this.mapTerrain) return;
    const canvas = document.querySelector("#world-map");
    canvas.width = this.mapTerrain.width;
    canvas.height = this.mapTerrain.height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapTerrain, 0, 0);
    const players = this.mapPlayers().sort((a, b) => Number(b.local) - Number(a.local) || a.username.localeCompare(b.username));
    const legend = document.querySelector("#map-player-list");
    legend.replaceChildren();

    const occupiedColors = new Set(this.playerMapColors.values());
    for (const player of players) {
      let color = "#f6d86b";
      if (!player.local) {
        if (!this.playerMapColors.has(player.id)) {
          const available = PLAYER_COLORS.find((candidate) => !occupiedColors.has(candidate)) || PLAYER_COLORS[this.playerMapColors.size % PLAYER_COLORS.length];
          this.playerMapColors.set(player.id, available);
          occupiedColors.add(available);
        }
        color = this.playerMapColors.get(player.id);
      }
      const x = Math.max(4, Math.min(canvas.width - 4, player.x * 2));
      const y = Math.max(4, Math.min(canvas.height - 4, player.y * 2));
      ctx.beginPath();
      ctx.arc(x, y, player.local ? 5.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff8d4";
      ctx.stroke();

      const label = `@${player.username}${player.local ? " · you" : ""}`;
      ctx.font = "8px GraphicPixel, monospace";
      ctx.textAlign = x > canvas.width - 60 ? "right" : "left";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(6, 9, 7, .95)";
      ctx.strokeText(label, x + (ctx.textAlign === "right" ? -6 : 6), y - 5);
      ctx.fillStyle = color;
      ctx.fillText(label, x + (ctx.textAlign === "right" ? -6 : 6), y - 5);

      const entry = document.createElement("button");
      entry.type = "button";
      entry.className = "map-player-entry";
      entry.setAttribute("aria-label", `Center map on @${player.username}`);
      const dot = document.createElement("i");
      dot.className = "map-player-dot";
      dot.style.backgroundColor = color;
      const name = document.createElement("span");
      name.textContent = `${label} · ${Math.round(player.x)},${Math.round(player.y)}`;
      entry.append(dot, name);
      entry.addEventListener("click", () => {
        if (this.mapZoom < 1.8) this.setMapZoom(2.2);
        requestAnimationFrame(() => this.focusMapAt(player.x, player.y));
      });
      legend.append(entry);
    }
    this.lastMapDraw = performance.now();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.viewport = { width: innerWidth, height: innerHeight };
    this.scale = this.chooseScale();
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.dpr = dpr;

    // Create or resize the water overlay canvas to match viewport (CSS pixels)
    try {
      if (!this.waterCanvas) {
        this.waterCanvas = document.createElement("canvas");
        this.waterCanvas.id = "water-overlay";
        this.waterCanvas.style.position = "fixed";
        this.waterCanvas.style.left = "0";
        this.waterCanvas.style.top = "0";
        this.waterCanvas.style.pointerEvents = "none";
        this.waterCanvas.style.zIndex = "2";
        this.waterCanvas.style.mixBlendMode = "overlay";
        this.waterCanvas.style.width = "100%";
        this.waterCanvas.style.height = "100%";
        this.waterCanvas.style.imageRendering = "pixelated";
        document.getElementById("game-shell").appendChild(this.waterCanvas);
        this.waterCtx = this.waterCanvas.getContext("2d");
      }
      // set backing store to CSS pixels times dpr for crispness
      const cssW = Math.round(innerWidth);
      const cssH = Math.round(innerHeight);
      this.waterCanvas.width = Math.round(cssW * dpr);
      this.waterCanvas.height = Math.round(cssH * dpr);
      // ensure the displayed size remains full-screen (CSS)
      this.waterCanvas.style.width = `${cssW}px`;
      this.waterCanvas.style.height = `${cssH}px`;
      // transform for high-DPI drawing
      this.waterCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.waterCtx.imageSmoothingEnabled = false;
    } catch (e) {
      // graceful fallback: ignore overlay if creation fails
      this.waterCanvas = null;
      this.waterCtx = null;
    }
  }

  chooseScale() {
    if (innerWidth < 520) return 2;
    if (innerWidth > 1450 && innerHeight > 820) return 4;
    return 3;
  }

  handlePointer(event) {
    if (!this.player.alive || document.querySelector("#chat-form").classList.contains("open")) return;
    const rect = this.canvas.getBoundingClientRect();
    const worldX = (event.clientX - rect.left + this.camera.x) / (TILE * this.scale);
    const worldY = (event.clientY - rect.top + this.camera.y) / (TILE * this.scale);
    const x = Math.floor(worldX), y = Math.floor(worldY);
    const entity = this.findInteractiveAt(x, y);
    this.combatTarget = null;
    this.pendingInteraction = null;

    if (entity) {
      this.pendingInteraction = entity.id;
      if (entity.category === "mob") this.combatTarget = entity.id;
      this.path = this.pathForInteraction(entity);
      if (!this.path.length) this.tryInteraction(entity);
    } else if (isWalkable(this.world, x, y)) {
      this.path = findPath(this.world, this.player, { x, y });
      if (this.path.length) this.play("npc");
    }
  }

  pathForInteraction(entity) {
    if (entity.category === "item" || entity.category === "loot") {
      return findPath(this.world, this.player, entity);
    }
    const candidates = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy }))
      .filter((pos) => isWalkable(this.world, pos.x, pos.y));
    let best = [];
    for (const candidate of candidates) {
      if (candidate.x === this.player.x && candidate.y === this.player.y) return [];
      const path = findPath(this.world, this.player, candidate);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
    return best;
  }

  findInteractiveAt(x, y) {
    const dynamic = this.dynamicLoot();
    const candidates = [...dynamic, ...this.entities];
    return candidates.find((entity) => entity.x === x && entity.y === y && this.isEntityActive(entity));
  }

  dynamicLoot() {
    const now = Date.now();
    return Object.entries(this.roomState.loot || {}).filter(([, item]) => item && (!item.expiresAt || item.expiresAt > now)).map(([id, item]) => ({ id, category: "loot", ...item }));
  }

  isEntityActive(entity) {
    const now = Date.now();
    if (entity.category === "mob") return !this.mobIsDefeated(entity, now);
    if (entity.category === "item") return !((this.roomState.worldItems || {})[entity.id]?.takenUntil > now);
    if (entity.category === "chest") return !((this.roomState.chests || {})[entity.id]?.openedUntil > now);
    return true;
  }

  tryInteraction(entity) {
    const distance = Math.abs(entity.x - this.player.x) + Math.abs(entity.y - this.player.y);
    const needed = (entity.category === "item" || entity.category === "loot") ? 0 : 1;
    if (distance > needed) return false;
    this.pendingInteraction = null;

    if (entity.category === "mob") {
      this.combatTarget = entity.id;
      this.attackMob(entity);
    } else if (entity.category === "npc") {
      this.face(entity.x, entity.y);
      if (entity.kind === "villager") this.openShop();
      this.showToast(entity.kind === "villager" ? "Merchant: browse my wares" : (NPC_LINES[entity.kind] || NPC_LINES.default), 3300);
      this.play("npctalk");
    } else if (entity.category === "item" || entity.category === "loot") {
      this.collectItem(entity);
    } else if (entity.category === "chest") {
      this.openChest(entity);
    }
    return true;
  }

  collectItem(entity) {
    if (entity.category === "loot") this.setShared("loot", entity.id, null);
    else this.setShared("worldItems", entity.id, { takenUntil: Date.now() + 30000 });
    if (entity.kind === "gold") {
      this.player.coins += Math.max(0, Number(entity.value) || 0);
      this.updateHud();
      this.markSaveDirty();
      this.showToast(`Collected ${entity.value} gold`);
    } else this.applyItem(entity.kind);
    this.bridge.send({ type: "loot", echo: true, kind: entity.kind });
  }

  applyItem(kind, store = true) {
    if (store && ITEM_KINDS.has(kind) && !this.player.inventory.includes(kind)) this.player.inventory.push(kind);
    if (WEAPONS.includes(kind)) {
      if (WEAPONS.indexOf(kind) >= WEAPONS.indexOf(this.player.weapon)) {
        this.player.weapon = kind;
        this.showToast(`Equipped ${LABELS[kind]}`);
      } else this.showToast(`${LABELS[kind]} is weaker than your current weapon`);
    } else if (ARMORS.includes(kind)) {
      if (ARMORS.indexOf(kind) >= ARMORS.indexOf(this.player.armor)) {
        this.player.armor = kind;
        this.recalculateHealth(true);
        this.showToast(`Equipped ${LABELS[kind]}`);
      } else this.showToast(`${LABELS[kind]} is lighter than your current armor`);
    } else if (kind === "firepotion") {
      this.fireBuffUntil = performance.now() + 10000;
      this.showToast("Flame power surges through your weapon");
      this.play("firefox");
    } else {
      const healing = kind === "cake" ? 55 : kind === "burger" ? 35 : 25;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healing);
      this.showToast(`Restored ${healing} health`);
      this.play("heal");
    }
    this.updateHud();
    this.publish(true);
    this.markSaveDirty();
  }

  gainXp(amount) {
    this.player.xp += Math.max(0, Number(amount) || 0);
    let leveled = false;
    while (this.player.level < MAX_LEVEL && this.player.xp >= this.player.level * 100) {
      this.player.xp -= this.player.level * 100;
      this.player.level += 1;
      this.player.skillPoints += 1;
      leveled = true;
    }
    if (leveled) {
      this.recalculateHealth(true);
      this.showToast(`Level ${this.player.level}! Choose a skill in your inventory`);
      this.markSaveDirty();
    }
    this.updateHud();
  }

  openChest(entity) {
    this.setShared("chests", entity.id, { openedUntil: Date.now() + 45000 });
    const sourceKinds = (entity.chestItems || []).map(numberToKind).filter(Boolean);
    const kind = sourceKinds[0] || WEAPONS[Math.min(WEAPONS.length - 1, 1 + (hashString(entity.id) % 4))];
    const id = `loot-${entity.id}-${Date.now()}`;
    this.setShared("loot", id, { kind, x: entity.x, y: entity.y + 1, expiresAt: Date.now() + 45000 });
    this.showToast("The chest opens");
    this.play("chest");
  }

  attackNearby() {
    const mob = this.entities.filter((entity) => entity.category === "mob" && this.isEntityActive(entity))
      .sort((a, b) => distanceTo(this.player, a) - distanceTo(this.player, b))[0];
    if (!mob || distanceTo(this.player, mob) > 1) {
      this.showToast("No creature in reach", 1000);
      return;
    }
    this.combatTarget = mob.id;
    this.attackMob(mob);
  }

  doubleJump() {
    const now = performance.now();
    if (!this.player.alive || now < this.nextStepAt || this.jumpCount >= MAX_JUMPS && now < this.jumpUntil) return;
    if (now >= this.jumpUntil) this.jumpCount = 0;

    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.player.dir];
    if (!delta) return;
    const x = this.player.x + delta[0], y = this.player.y + delta[1];
    if (!isWalkable(this.world, x, y)) return;

    this.path = [];
    this.pendingInteraction = null;
    this.combatTarget = null;
    this.stepTo(x, y);
    this.jumpCount += 1;
    this.jumpStartedAt = now;
    this.jumpUntil = now + JUMP_DURATION;
    this.play("npc");
    this.publish(true);
  }

  attackMob(mob) {
    const now = performance.now();
    if (!this.player.alive || now < this.nextAttackAt || distanceTo(this.player, mob) > 1) return;
    const state = this.getMobState(mob);
    if (state.defeated) return;
    this.face(mob.x, mob.y);
    this.nextAttackAt = now + Math.max(220, 600 - this.player.dexterity * 12);
    this.attackStartedAt = now;
    this.attackUntil = now + 430;
    const weaponRank = WEAPONS.indexOf(this.player.weapon) + 1;
    const buff = now < this.fireBuffUntil ? 10 : 0;
    const classData = RPG_CLASSES[this.player.classId] || RPG_CLASSES.warrior;
    const skillBonus = this.player.skills.length * 2;
    const damage = Math.round((8 + weaponRank * 6 + this.player.strength + buff + skillBonus + Math.floor(Math.random() * 5)) * classData.power);
    const hp = Math.max(0, state.hp - damage);
    const nextState = hp > 0 ? { hp, hitAt: Date.now() } : { hp: 0, defeatedUntil: Date.now() + 18000, hitAt: Date.now() };
    this.setShared("mobs", mob.id, nextState);
    mob.hurtUntil = now + 190;
    this.bridge.send({ type: "attack", echo: true, mobId: mob.id, damage });
    this.floatText = { text: `-${damage}`, x: mob.x, y: mob.y, until: now + 700 };

    if (hp === 0) {
      const choices = DROP_TABLES[mob.kind] || ["flask"];
      const kind = choices[Math.floor(Math.random() * choices.length)];
      const lootId = `loot-${mob.id}-${Date.now()}`;
      this.setShared("loot", lootId, { kind, x: mob.x, y: mob.y, expiresAt: Date.now() + 30000 });
      const coinId = `gold-${mob.id}-${Date.now()}`;
      const coinValue = Math.max(2, Math.round((MOB_HP[mob.kind] || 50) / 12));
      this.setShared("loot", coinId, { kind: "gold", value: coinValue, x: mob.x, y: mob.y, expiresAt: Date.now() + 30000 });
      this.showToast(`${MOB_NAMES[mob.kind] || capitalize(mob.kind)} defeated`);
      this.play("kill1");
      this.gainXp(20 + (MOB_HP[mob.kind] || 50));
      this.combatTarget = null;
    }
  }

  getMobState(mob) {
    const raw = (this.roomState.mobs || {})[mob.id];
    const maxHp = MOB_HP[mob.kind] || 80;
    if (!raw) return { hp: maxHp, maxHp, defeated: false };
    if (raw.defeatedUntil && raw.defeatedUntil > Date.now()) return { hp: 0, maxHp, defeated: true };
    if (raw.defeatedUntil && raw.defeatedUntil <= Date.now()) return { hp: maxHp, maxHp, defeated: false };
    return { hp: Number.isFinite(raw.hp) ? raw.hp : maxHp, maxHp, defeated: false };
  }

  mobIsDefeated(mob, now = Date.now()) {
    const state = (this.roomState.mobs || {})[mob.id];
    return Boolean(state?.defeatedUntil && state.defeatedUntil > now);
  }

  canMobSeePlayer(mob) {
    return distanceTo(this.player, mob) <= (this.stealthUntil > performance.now() ? 0 : 1);
  }

  activateStealth() {
    if (!this.player.alive || this.stealthUntil > performance.now()) return;
    this.stealthUntil = performance.now() + 8000;
    this.publish(true);
    this.showToast("Stealth active · enemy aggro reduced");
  }

  setShared(section, id, value) {
    const current = { ...(this.roomState[section] || {}) };
    if (value === null) delete current[id];
    else current[id] = value;
    this.roomState = { ...this.roomState, [section]: current };
    this.bridge.updateRoomState({ [section]: { [id]: value } });
  }

  tryDirectionalStep(direction) {
    if (!this.player.alive || performance.now() < this.nextStepAt) return;
    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    if (!delta) return;
    this.path = [];
    this.pendingInteraction = null;
    this.combatTarget = null;
    const x = this.player.x + delta[0], y = this.player.y + delta[1];
    if (isWalkable(this.world, x, y)) this.stepTo(x, y);
  }

  stepTo(x, y) {
    this.face(x, y);
    this.player.x = x;
    this.player.y = y;
    this.nextStepAt = performance.now() + 115;
    const door = this.world.doors.get(`${x},${y}`);
    if (door) {
      const destination = nearestWalkable(this.world, door.tx, door.ty);
      this.player.x = destination.x;
      this.player.y = destination.y;
      this.player.rx = destination.x;
      this.player.ry = destination.y;
      this.path = [];
      this.pendingInteraction = null;
      this.play("teleport");
    }
    this.publish();
    this.markSaveDirty();
    this.playFootstep(x, y);
  }

  startAmbientAudio() {
    if (this.ambientAudio || !window.AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 78;
    gain.gain.value = 0.012;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    this.ambientAudio = context;
    this.ambientNodes = { oscillator, gain };
  }

  stopAmbientAudio() {
    if (!this.ambientAudio) return;
    this.ambientNodes?.oscillator.stop();
    this.ambientAudio.close();
    this.ambientAudio = null;
    this.ambientNodes = null;
  }

  playFootstep(x, y) {
    if (!this.soundEnabled || !window.AudioContext) return;
    const tile = this.world.map.data[y * this.world.map.width + x];
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = Array.isArray(tile) ? 105 : Number(tile) % 3 === 0 ? 145 : 115;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  }

  face(x, y) {
    const dx = x - this.player.x, dy = y - this.player.y;
    if (Math.abs(dx) > Math.abs(dy)) this.player.dir = dx < 0 ? "left" : "right";
    else if (dy !== 0) this.player.dir = dy < 0 ? "up" : "down";
  }

  // Custom pointer-driven joystick for mobile/touch devices
  initJoystickIfMobile() {
    try {
      const isTouch = window.matchMedia && (matchMedia("(pointer: coarse)").matches || innerWidth <= 720);
      const zone = document.querySelector("#joystick-zone");
      if (!isTouch || !zone) return;

      // Clear any existing content
      zone.innerHTML = "";

      // Build base and knob that match our CSS classes (.nipple-base, .nipple)
      const base = document.createElement("div");
      base.className = "nipple-base";
      base.style.position = "relative";
      base.style.touchAction = "none";

      const knob = document.createElement("div");
      knob.className = "nipple";
      knob.style.position = "absolute";
      knob.style.left = "50%";
      knob.style.top = "50%";
      knob.style.transform = "translate(-50%, -50%)";
      knob.style.touchAction = "none";

      // small inner visual cross for the knob
      const v = document.createElement("i");
      knob.appendChild(v);

      base.appendChild(knob);
      zone.appendChild(base);

      const rect = () => base.getBoundingClientRect();
      const radius = Math.min((rect().width || 110) / 2, 60);
      let activePointer = null;

      const resetKnob = () => {
        knob.style.transition = "transform 150ms ease";
        knob.style.transform = "translate(-50%, -50%)";
        this.joystickDir = null;
        setTimeout(() => (knob.style.transition = ""), 160);
      };

      // Compute direction from a point; stable dominant-axis mapping with deadzone.
      const updateFromPoint = (clientX, clientY) => {
        const r = rect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, radius);
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);

        // Move knob visually (CSS Y increases downward)
        const px = nx * clamped;
        const py = ny * clamped;
        knob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;

        // Determine direction by dominant axis to avoid diagonal ambiguity
        let dir = null;
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
        else dir = dy < 0 ? "up" : "down"; // dy < 0 means pointer is above center -> up

        const deadzone = Math.max(6, radius * 0.18);
        this.joystickDir = dist > deadzone ? dir : null;
      };

      // We'll capture pointer on the base and listen to moves on window to avoid pointerleave glitches.
      base.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        try { base.setPointerCapture(ev.pointerId); } catch {}
        activePointer = ev.pointerId;
        updateFromPoint(ev.clientX, ev.clientY);
      });

      // move events on window ensure continuous tracking even if the pointer moves outside the element
      const onMove = (ev) => {
        if (activePointer === null || ev.pointerId !== activePointer) return;
        ev.preventDefault();
        updateFromPoint(ev.clientX, ev.clientY);
      };

      const onUp = (ev) => {
        if (activePointer === null || ev.pointerId !== activePointer) return;
        try { base.releasePointerCapture?.(activePointer); } catch {}
        activePointer = null;
        resetKnob();
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      // Also gracefully handle pointer leaving the base area (but do not treat that as a hard stop)
      base.addEventListener("pointerleave", (ev) => {
        // if the pointer left but is still pressed we keep following it via window listeners;
        // only reset if it's not the active pointer.
        if (activePointer === null) resetKnob();
      });

      // Prevent accidental page scrolling while interacting
      zone.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
      zone.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

      // Ensure joystick resets when window changes or visibility toggles
      addEventListener("resize", resetKnob);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") resetKnob(); });
    } catch (e) {
      console.info("Custom joystick unavailable", e);
    }
  }

  update(time, dt) {
    if (this.player.alive) {
      const held = this.heldDirection();
      if (held && time >= this.nextStepAt) this.tryDirectionalStep(held);
      else if (!held && this.path.length && time >= this.nextStepAt) {
        const next = this.path.shift();
        if (isWalkable(this.world, next.x, next.y)) this.stepTo(next.x, next.y);
        else this.path = [];
      }
    }

    const smoothing = Math.min(1, dt * 14);
    this.player.rx += (this.player.x - this.player.rx) * smoothing;
    this.player.ry += (this.player.y - this.player.ry) * smoothing;

    if (this.pendingInteraction && !this.path.length && Math.abs(this.player.rx - this.player.x) < 0.08 && Math.abs(this.player.ry - this.player.y) < 0.08) {
      const target = this.entityById.get(this.pendingInteraction) || this.dynamicLoot().find((item) => item.id === this.pendingInteraction);
      if (target && this.isEntityActive(target)) this.tryInteraction(target);
      else this.pendingInteraction = null;
    }

    if (this.combatTarget) {
      const mob = this.entityById.get(this.combatTarget);
      if (mob && this.isEntityActive(mob) && distanceTo(this.player, mob) <= 1) this.attackMob(mob);
      else if (!mob || !this.isEntityActive(mob)) this.combatTarget = null;
    }

    if (this.player.alive && time >= this.nextMobHitAt) {
      const nearby = this.entities.find((entity) => entity.category === "mob" && this.isEntityActive(entity) && distanceTo(this.player, entity) <= 1);
      if (nearby && this.canMobSeePlayer(nearby)) {
        this.nextMobHitAt = time + 1050;
        nearby.attackUntil = time + 420;
        const armorRank = ARMORS.indexOf(this.player.armor) + 1;
        const damage = Math.max(1, (MOB_DAMAGE[nearby.kind] || 6) - armorRank + Math.floor(Math.random() * 3));
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.floatText = { text: `-${damage}`, x: this.player.x, y: this.player.y, until: time + 700, player: true };
        this.play("hurt");
        this.updateHud();
        this.publish(true);
        this.markSaveDirty();
        if (this.player.hp <= 0) this.die();
      }
    }

    const tileSize = TILE * this.scale;
    const targetCameraX = this.player.rx * tileSize + tileSize / 2 - this.viewport.width / 2;
    const targetCameraY = this.player.ry * tileSize + tileSize / 2 - this.viewport.height / 2;
    this.camera.x += (targetCameraX - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (targetCameraY - this.camera.y) * Math.min(1, dt * 8);
    this.publish(false, time);
    if (this.saveDirty && Date.now() - this.lastAutoSaveAt >= AUTO_SAVE_INTERVAL) this.saveGame(false);
    if (document.querySelector("#map-modal")?.open && time - this.lastMapDraw > 250) this.drawWorldMap();
  }

  heldDirection() {
    // prioritize keyboard keys, then joystick direction
    if (this.keys.has("arrowup") || this.keys.has("w")) return "up";
    if (this.keys.has("arrowdown") || this.keys.has("s")) return "down";
    if (this.keys.has("arrowleft") || this.keys.has("a")) return "left";
    if (this.keys.has("arrowright") || this.keys.has("d")) return "right";
    if (this.joystickDir) return this.joystickDir;
    return null;
  }

  die() {
    if (this.respawning) return;
    this.respawning = true;
    this.player.alive = false;
    this.player.respawnAt = Date.now() + 2800;
    this.path = [];
    this.combatTarget = null;
    document.querySelector("#death-screen").hidden = false;
    this.play("death");
    this.publish(true);
    this.markSaveDirty();
    this.saveGame(false);
    setTimeout(() => this.respawn(), 2800);
  }

  respawn() {
    const spawn = nearestWalkable(this.world, 18, 211);
    Object.assign(this.player, { x: spawn.x, y: spawn.y, rx: spawn.x, ry: spawn.y, hp: this.player.maxHp, alive: true, dir: "down", respawnAt: 0 });
    this.respawning = false;
    document.querySelector("#death-screen").hidden = true;
    this.updateHud();
    this.publish(true);
    this.markSaveDirty();
    this.saveGame(false);
    this.play("revive");
  }

  recalculateHealth(fill = false) {
    const oldMax = this.player.maxHp;
    const classData = RPG_CLASSES[this.player.classId] || RPG_CLASSES.warrior;
    this.player.maxHp = classData.baseHp + (this.player.level - 1) * 12 + this.player.vitality * 3 + Math.max(0, ARMORS.indexOf(this.player.armor)) * 18;
    this.player.hp = fill ? this.player.maxHp : Math.min(this.player.maxHp, this.player.hp + (this.player.maxHp - oldMax));
    this.updateHud();
  }

  presenceSnapshot() {
    return {
      x: this.player.x, y: this.player.y, px: this.player.rx, py: this.player.ry,
      dir: this.player.dir, moving: this.path.length > 0 || Boolean(this.heldDirection()),
      hp: this.player.hp, maxHp: this.player.maxHp, armor: this.player.armor, weapon: this.player.weapon,
      alive: this.player.alive, chat: this.player.chat, chatAt: this.player.chatAt,
      classId: this.player.classId, level: this.player.level, xp: this.player.xp,
      strength: this.player.strength, intellect: this.player.intellect, vitality: this.player.vitality, dexterity: this.player.dexterity,
      stealth: this.stealthUntil > performance.now(), pvpEnabled: this.pvpEnabled,
      attacking: this.attackUntil > performance.now(), attackAt: this.attackUntil > performance.now()
        ? Date.now() - Math.max(0, performance.now() - this.attackStartedAt) : 0,
      jumping: this.jumpUntil > performance.now(),
      jumpAt: this.jumpUntil > performance.now()
        ? Date.now() - Math.max(0, performance.now() - this.jumpStartedAt)
        : 0,
    };
  }

  publish(force = false, time = performance.now()) {
    if (!force && time - this.lastPresenceAt < 90) return;
    this.lastPresenceAt = time;
    this.bridge.updatePresence(this.presenceSnapshot());
  }

  render(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    drawWorldTiles(ctx, this.world, this.tileset, this.camera, this.viewport, this.scale, false, time, this.chunkManager);

    const drawables = [];
    for (const entity of this.entities) if (this.isEntityActive(entity)) drawables.push({ type: "entity", y: entity.y, value: entity });
    for (const item of this.dynamicLoot()) drawables.push({ type: "entity", y: item.y, value: item });
    let hasLocalPlayer = false;
    for (const [id, presence] of Object.entries(this.remotePresence || {})) {
      if (!presence || presence.alive === false) continue;
      if (id === this.bridge.clientId || (!this.bridge.online && id === "local")) hasLocalPlayer = true;
      drawables.push({ type: "player", y: Number(presence.py ?? presence.y ?? 0), value: presence, id });
    }
    if (this.player.alive && !hasLocalPlayer) {
      drawables.push({ type: "player", y: this.player.ry, value: this.presenceSnapshot(), id: this.bridge.clientId });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const drawable of drawables) {
      if (drawable.type === "player") this.drawPlayer(drawable.value, drawable.id, time);
      else this.drawEntity(drawable.value, time);
    }

    drawWorldTiles(ctx, this.world, this.tileset, this.camera, this.viewport, this.scale, true, time, this.chunkManager);
    this.drawTarget();
    this.drawFloatingText(time);
    if (time - (this.lastWaterDrawAt || 0) >= 33) {
      this.drawWaterFlow(time);
      this.lastWaterDrawAt = time;
    }
  }

  drawEntity(entity, time) {
    const px = entity.x * TILE - this.camera.x / this.scale;
    const py = entity.y * TILE - this.camera.y / this.scale;
    if (px < -40 || py < -40 || px * this.scale > this.viewport.width + 40 || py * this.scale > this.viewport.height + 40) return;
    const frame = Math.floor((time + entity.phase) / 145);
    let sprite = entity.kind;
    let animation = "idle_down";
    let flip = false;

    if (entity.category === "item" || entity.category === "loot") {
      if (entity.kind === "gold") {
        const x = entity.x * TILE * this.scale - this.camera.x;
        const y = entity.y * TILE * this.scale - this.camera.y;
        this.ctx.fillStyle = "#f6d86b";
        this.ctx.fillRect(x + 5 * this.scale, y + 4 * this.scale, 6 * this.scale, 6 * this.scale);
        this.ctx.fillStyle = "#fff2a5";
        this.ctx.fillRect(x + 6 * this.scale, y + 4 * this.scale, 2 * this.scale, 2 * this.scale);
        return;
      }
      sprite = `item-${entity.kind}`;
      animation = "idle";
    } else if (entity.category === "chest") {
      animation = "idle_down";
    } else if (entity.category === "mob") {
      const attacking = entity.attackUntil > time;
      animation = attacking ? "atk_down" : "idle_down";
    }

    this.bank.draw(this.ctx, sprite, animation, frame, px, py, this.scale, { flip, alpha: entity.hurtUntil > time ? 0.55 : 1 });
    if (entity.category === "mob") {
      const state = this.getMobState(entity);
      if (state.hp < state.maxHp) this.drawHealthBar(entity.x, entity.y, state.hp / state.maxHp);
      if (entity.kind === "sylvan") {
        const labelX = entity.x * TILE * this.scale - this.camera.x + TILE * this.scale / 2;
        const labelY = entity.y * TILE * this.scale - this.camera.y - 42 * this.scale;
        this.drawLabel(MOB_NAMES.sylvan, labelX, labelY, "#a8e28c");
      }
    }
  }

  drawPlayer(presence, id, time) {
    const isLocal = id === this.bridge.clientId || (!this.bridge.online && id === "local");
    const gx = isLocal ? this.player.rx : Number(presence.px ?? presence.x ?? 0);
    const gy = isLocal ? this.player.ry : Number(presence.py ?? presence.y ?? 0);
    const px = gx * TILE - this.camera.x / this.scale;
    const py = gy * TILE - this.camera.y / this.scale;
    const direction = isLocal ? this.player.dir : (presence.dir || "down");
    const moving = isLocal ? (Math.abs(this.player.rx - this.player.x) > 0.02 || this.path.length > 0 || Boolean(this.heldDirection())) : Boolean(presence.moving);
    const attackElapsed = isLocal ? time - this.attackStartedAt : Date.now() - Number(presence.attackAt || 0);
    const attacking = isLocal ? this.attackUntil > time : Boolean(presence.attacking) && attackElapsed >= 0 && attackElapsed < 430;
    const baseDir = direction === "left" ? "right" : direction;
    const animation = `${attacking ? "atk" : moving ? "walk" : "idle"}_${baseDir}`;
    const flip = direction === "left";
    const frame = attacking ? Math.floor(attackElapsed / 72) : Math.floor(time / (moving ? 105 : 300));
    const armor = ARMORS.includes(presence.armor) ? presence.armor : "clotharmor";
    const weapon = WEAPONS.includes(presence.weapon) ? presence.weapon : "sword1";

    const jumpElapsed = isLocal ? time - this.jumpStartedAt : Date.now() - Number(presence.jumpAt || 0);
    const jumping = isLocal ? this.jumpUntil > time : Boolean(presence.jumping) && jumpElapsed >= 0 && jumpElapsed < JUMP_DURATION;
    const jumpLift = jumping ? Math.sin(Math.min(1, jumpElapsed / JUMP_DURATION) * Math.PI) * 6 : 0;
    const walkPhase = Math.sin(time * 0.018 + (isLocal ? 0 : Number(presence.x || 0))) * (moving && !attacking ? 1.5 : 0);
    const attackProgress = attacking ? Math.min(1, Math.max(0, attackElapsed / 430)) : 0;
    const lunge = attacking ? Math.sin(attackProgress * Math.PI) * 4 : 0;
    const directionX = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    const directionY = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    const actionX = directionX * lunge;
    const actionY = directionY * lunge;
    this.bank.draw(this.ctx, "shadow16", "idle", 0, px + actionX * .55, py + actionY * .55, this.scale, { alpha: jumping ? 0.3 : attacking ? 0.42 : 0.55 });
    this.bank.draw(this.ctx, armor, animation, frame, px + actionX, py - jumpLift + walkPhase - (attacking ? attackProgress * 1.5 : 0), this.scale, { flip });
    this.bank.draw(this.ctx, weapon, animation, frame, px + actionX + directionX * (attacking ? 1.5 : 0), py - jumpLift + walkPhase + actionY, this.scale, { flip });

    const peer = this.peers[id] || {};
    const username = peer.username || presence.username || (isLocal ? this.bridge.identity.username : "Adventurer");
    const sx = gx * TILE * this.scale - this.camera.x + (TILE * this.scale) / 2;
    const sy = gy * TILE * this.scale - this.camera.y - 24 * this.scale;
    this.drawLabel(`@${username}`, sx, sy, isLocal ? "#f6d86b" : "#ffffff");

    if (presence.chat && Date.now() - Number(presence.chatAt || 0) < 6500) {
      this.drawBubble(presence.chat, sx, sy - 25);
    }
  }

  drawHealthBar(x, y, ratio) {
    const sx = x * TILE * this.scale - this.camera.x - 2 * this.scale;
    const sy = y * TILE * this.scale - this.camera.y - 11 * this.scale;
    const width = 20 * this.scale;
    this.ctx.fillStyle = "rgba(0,0,0,.75)";
    this.ctx.fillRect(sx, sy, width, 3 * this.scale);
    this.ctx.fillStyle = "#d94a3f";
    this.ctx.fillRect(sx + this.scale, sy + this.scale, Math.max(0, (width - 2 * this.scale) * ratio), this.scale);
  }

  drawTarget() {
    const target = this.combatTarget && this.entityById.get(this.combatTarget);
    if (!target || !this.isEntityActive(target)) return;
    const x = target.x * TILE * this.scale - this.camera.x;
    const y = target.y * TILE * this.scale - this.camera.y;
    this.ctx.strokeStyle = "rgba(255, 80, 55, .9)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, TILE * this.scale - 2, TILE * this.scale - 2);
  }

  drawFloatingText(time) {
    if (!this.floatText || this.floatText.until < time) return;
    const progress = 1 - (this.floatText.until - time) / 700;
    const sx = this.floatText.x * TILE * this.scale - this.camera.x + (TILE * this.scale) / 2;
    const sy = this.floatText.y * TILE * this.scale - this.camera.y - (14 + progress * 10) * this.scale;
    this.drawLabel(this.floatText.text, sx, sy, this.floatText.player ? "#ffb3a6" : "#fff3a6");
  }

  drawWaterFlow(time) {
    if (!this.waterCtx || !this.waterCanvas) return;
    const ctx = this.waterCtx;
    const width = this.waterCanvas.width / (this.dpr || 1);
    const height = this.waterCanvas.height / (this.dpr || 1);
    this.waterFlowPhase += (time - (this.lastWaterFlowTime || time)) * 0.0008;
    this.lastWaterFlowTime = time;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = this.waterOverlayAlpha;
    ctx.strokeStyle = "#8bcad1";
    ctx.lineWidth = 1;
    for (let row = 0; row < 5; row++) {
      const y = height * (row + 1) / 6 + Math.sin(this.waterFlowPhase + row) * 6;
      ctx.beginPath();
      for (let x = -20; x <= width + 20; x += 8) {
        const wave = y + Math.sin(x * 0.012 + this.waterFlowPhase * 2 + row) * 4;
        if (x === -20) ctx.moveTo(x, wave);
        else ctx.lineTo(x, wave);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawLabel(text, x, y, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${Math.max(13, 5 * this.scale)}px GraphicPixel, monospace`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(10, 12, 10, .9)";
    ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = color;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
  }

  drawBubble(message, x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "14px GraphicPixel, monospace";
    const text = message.length > 42 ? `${message.slice(0, 41)}…` : message;
    const width = Math.min(330, ctx.measureText(text).width + 20);
    const bx = Math.max(8, Math.min(this.viewport.width - width - 8, x - width / 2));
    ctx.fillStyle = "rgba(250, 245, 215, .95)";
    ctx.strokeStyle = "#28251d";
    ctx.lineWidth = 2;
    ctx.fillRect(bx, y - 22, width, 24);
    ctx.strokeRect(bx, y - 22, width, 24);
    ctx.fillStyle = "#24231e";
    ctx.textAlign = "center";
    ctx.fillText(text, bx + width / 2, y - 6);
    ctx.restore();
  }

  updateHud() {
    document.querySelector("#health-fill").style.width = `${Math.max(0, this.player.hp / this.player.maxHp * 100)}%`;
    const healthValue = document.querySelector("#health-value");
    if (healthValue) healthValue.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
    document.querySelector("#equipment").textContent = `${LABELS[this.player.armor]} · ${LABELS[this.player.weapon]}`;
    const progression = document.querySelector("#player-progression");
    if (progression) progression.textContent = `${RPG_CLASSES[this.player.classId]?.label || "Warrior"} · Lv ${this.player.level} · ${this.player.xp}/${this.player.level * 100} XP`;
    const coinEl = document.querySelector("#player-coins");
    if (coinEl) coinEl.textContent = String(Math.max(0, Number(this.player.coins || 0)));
  }

  openChat() {
    const form = document.querySelector("#chat-form");
    const button = document.querySelector("#chat-button");
    form.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Close chat");
    document.querySelector("#chat-input").focus();
    this.keys.clear();
  }

  // Shop UI handlers
  openShop() {
    const modal = document.querySelector("#shop-modal");
    if (!modal) return;
    this.renderShopList();
    modal.showModal();
  }

  closeShop() {
    const modal = document.querySelector("#shop-modal");
    if (!modal) return;
    modal.close();
  }

  renderShopList() {
    const list = document.querySelector("#shop-list");
    if (!list) return;
    list.replaceChildren();
    for (const item of this.shopItems) {
      const entry = document.createElement("div");
      entry.className = "shop-entry";
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "8px";
      left.style.alignItems = "center";
      const img = document.createElement("img");
      img.src = `assets/img/item-${item.id}.png`;
      img.alt = "";
      img.style.width = "28px";
      img.style.height = "28px";
      img.style.imageRendering = "pixelated";
      const label = document.createElement("div");
      label.textContent = `${item.label} · ${item.price} ¥`;
      left.append(img, label);

      const buy = document.createElement("button");
      buy.type = "button";
      buy.textContent = "Buy";
      buy.addEventListener("click", () => this.buyShopItem(item));

      entry.append(left, buy);
      list.appendChild(entry);
    }
    this.renderInventory();
  }

  renderInventory() {
    const list = document.querySelector("#inventory-list");
    if (!list) return;
    list.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = `Inventory · ${RPG_CLASSES[this.player.classId].label} Lv ${this.player.level} · ${this.player.xp}/${this.player.level * 100} XP`;
    list.append(heading);
    for (const kind of this.player.inventory) {
      const entry = document.createElement("div");
      entry.className = "inventory-entry";
      const label = document.createElement("span");
      label.textContent = LABELS[kind] || kind;
      const equip = document.createElement("button");
      equip.type = "button";
      equip.textContent = kind === this.player.weapon || kind === this.player.armor ? "Equipped" : "Equip";
      equip.disabled = equip.textContent === "Equipped";
      equip.addEventListener("click", () => {
        if (WEAPONS.includes(kind)) this.player.weapon = kind;
        if (ARMORS.includes(kind)) this.player.armor = kind;
        this.recalculateHealth(false);
        this.markSaveDirty();
        this.renderInventory();
        this.updateHud();
      });
      const sell = document.createElement("button");
      sell.type = "button";
      sell.textContent = `Sell ${Math.max(5, (WEAPONS.includes(kind) ? WEAPONS.indexOf(kind) : ARMORS.indexOf(kind)) * 10 + 5)} ¥`;
      sell.disabled = kind === this.player.weapon || kind === this.player.armor;
      sell.addEventListener("click", () => this.sellItem(kind));
      entry.append(label, equip, sell);
      list.append(entry);
    }
    const skills = document.createElement("p");
    skills.className = "skill-summary";
    skills.textContent = `Skills: ${this.player.skills.join(", ") || "none"} · Points: ${this.player.skillPoints}`;
    list.append(skills);
    if (this.player.skillPoints > 0) {
      for (const skill of LEVEL_TREE[this.player.classId]) {
        if (this.player.skills.includes(skill)) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Learn ${skill}`;
        button.addEventListener("click", () => {
          this.player.skills.push(skill);
          this.player.skillPoints -= 1;
          this.markSaveDirty();
          this.renderInventory();
        });
        list.append(button);
        break;
      }
    }
  }

  sellItem(kind) {
    const index = this.player.inventory.indexOf(kind);
    if (index < 0) return;
    this.player.inventory.splice(index, 1);
    const value = Math.max(5, (WEAPONS.includes(kind) ? WEAPONS.indexOf(kind) : ARMORS.indexOf(kind)) * 10 + 5);
    this.player.coins += value;
    this.updateHud();
    this.markSaveDirty();
    this.renderInventory();
    this.showToast(`Sold ${LABELS[kind]} for ${value} ¥`);
  }

  openPlayerInspect() {
    const modal = document.querySelector("#player-inspect-modal");
    const list = document.querySelector("#player-inspect-list");
    if (!modal || !list) return;
    list.replaceChildren();
    for (const player of this.mapPlayers()) {
      const presence = player.local ? this.presenceSnapshot() : this.remotePresence[player.id] || {};
      const entry = document.createElement("button");
      entry.type = "button";
      entry.className = "player-inspect-entry";
      entry.textContent = `@${player.username} · Lv ${presence.level || 1} ${RPG_CLASSES[presence.classId]?.label || "Warrior"} · ${LABELS[presence.weapon] || "Training sword"} · ${LABELS[presence.armor] || "Cloth"}`;
      list.append(entry);
    }
    modal.showModal();
  }

  buyShopItem(item) {
    const coins = Number(this.player.coins || 0);
    if (coins < item.price) {
      this.showToast("Not enough coins");
      this.play("noloot");
      return;
    }
    this.player.coins = coins - item.price;
    // grant item as weapon if applicable
    if (WEAPONS.includes(item.id)) {
      this.applyItem(item.id);
    } else {
      // fallback: give as consumable
      this.applyItem(item.id);
    }
    this.updateHud();
    this.markSaveDirty();
    this.publish(true);
    this.showToast(`Purchased ${item.label}`);
    this.play("loot");
  }

  closeChat() {
    document.querySelector("#chat-form").classList.remove("open");
    const button = document.querySelector("#chat-button");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open chat");
    document.querySelector("#chat-input").blur();
  }

  showToast(message, duration = 2200) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove("visible"), duration);
  }

  play(name) {
    if (!this.soundEnabled) return;
    try {
      let sound = this.audio.get(name);
      if (!sound) {
        sound = new Audio(`assets/audio/${name}.mp3`);
        sound.volume = 0.36;
        this.audio.set(name, sound);
      }
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch { /* Sound is ornamental; gameplay must never depend on it. */ }
  }

  loop(time) {
    const dt = Math.min(0.05, (time - this.lastFrame) / 1000);
    this.lastFrame = time;
    this.update(time, dt);
    this.render(time);
    requestAnimationFrame((next) => this.loop(next));
  }
}

function distanceTo(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

const PLAYER_COLORS = ["#47d7ff", "#ff62b0", "#70ed72", "#ba89ff", "#ff8a45", "#45f1ce", "#ffdf4e", "#e56cff", "#75a7ff", "#ff6b61"];

function waitForImage(image, label) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error(`Failed to load ${label}`)), { once: true });
  });
}

function newestSave(localSave, cloudSave) {
  if (!localSave) return cloudSave || null;
  if (!cloudSave) return localSave;
  return Number(cloudSave.savedAt || 0) >= Number(localSave.savedAt || 0) ? cloudSave : localSave;
}

function numberToKind(value) {
  return ({ 20: "firefox", 21: "clotharmor", 22: "leatherarmor", 23: "mailarmor", 24: "platearmor", 25: "redarmor", 26: "goldenarmor", 35: "flask", 36: "burger", 38: "firepotion", 39: "cake", 60: "sword1", 61: "sword2", 62: "redsword", 63: "goldensword", 64: "morningstar", 65: "axe", 66: "bluesword" })[value];
}

const game = new BrowserQuest();
game.init().catch((error) => {
  console.error(error);
  const loading = document.querySelector("#loading");
  loading.innerHTML = "<span>The realm could not be loaded</span><small>Check the console for details.</small>";
});
