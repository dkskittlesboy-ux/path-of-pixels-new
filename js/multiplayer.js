export class MultiplayerBridge {
  constructor() {
    this.protocolVersion = 2;
    this.saveCollection = "pathofpixels_accounts_v2";
    this.room = null;
    this.online = false;
    this.clientId = "local";
    this.identity = { id: "", username: "Adventurer", avatarUrl: "" };
    this.presence = {};
    this.roomState = {};
    this.onPresence = () => {};
    this.onRoomState = () => {};
    this.onStatus = () => {};
    this.onEvent = () => {};
    this.reconnectTimer = null;
    this.lastPresence = null;
  }

  async getIdentity() {
    try {
      const user = await window.websim?.getUser?.();
      if (user) {
        this.identity = {
          id: user.id || "",
          username: user.username || "Adventurer",
          avatarUrl: user.avatar_url || `https://images.websim.com/avatar/${encodeURIComponent(user.username)}`,
        };
      }
    } catch (error) {
      console.info("Your identity is unavailable in preview mode.", error);
    }
    return this.identity;
  }

  async connect(initialPresence) {
    this.lastPresence = initialPresence;
    const Socket = globalThis.WebsimSocket;
    if (!Socket) {
      this.presence = { local: { ...initialPresence, username: this.identity.username } };
      this.onPresence(this.presence, { local: this.identity });
      this.onStatus({ online: false, count: 1 });
      return false;
    }

    try {
      this.room = new Socket();
      this.room.onmessage = (event) => {
        const data = event.data || event;
        this.onEvent(data?.protocol === this.protocolVersion ? data : { ...data, protocol: this.protocolVersion });
      };
      await this.room.initialize();
      this.clientId = this.room.clientId;
      this.online = true;

      this.room.subscribePresence((presence) => {
        this.presence = presence || {};
        this.onPresence(this.presence, this.room.peers || {});
        this.onStatus({ online: true, count: Object.keys(this.room.peers || {}).length });
      });
      this.room.subscribeRoomState((state) => {
        this.roomState = state || {};
        this.onRoomState(this.roomState);
      });
      this.room.subscribePresenceUpdateRequests((request) => {
        if (request?.type === "heal") {
          const mine = this.room.presence[this.clientId] || initialPresence;
          this.updatePresence({ hp: Math.min(mine.maxHp || 100, (mine.hp || 0) + Number(request.amount || 0)) });
        }
      });

      this.updatePresence({ ...initialPresence, username: this.identity.username, protocol: this.protocolVersion });
      this.presence = this.room.presence || {};
      this.roomState = this.room.roomState || {};
      this.onPresence(this.presence, this.room.peers || {});
      this.onRoomState(this.roomState);
      this.onStatus({ online: true, count: Object.keys(this.room.peers || {}).length });
      return true;
    } catch (error) {
      console.warn("Multiplayer connection failed; continuing in solo mode.", error);
      this.room = null;
      this.online = false;
      this.clientId = "local";
      this.presence = { local: { ...initialPresence, username: this.identity.username } };
      this.onPresence(this.presence, { local: this.identity });
      this.onStatus({ online: false, count: 1 });
      this.scheduleReconnect();
      return false;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !globalThis.WebsimSocket || !this.lastPresence) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.online) await this.connect(this.lastPresence);
    }, 5000);
  }

  updatePresence(patch) {
    this.lastPresence = { ...(this.lastPresence || {}), ...patch };
    if (this.room) {
      this.room.updatePresence(patch);
      return;
    }
    this.presence.local = { ...(this.presence.local || {}), ...patch };
    this.onPresence(this.presence, { local: this.identity });
  }

  updateRoomState(patch) {
    if (this.room) {
      this.room.updateRoomState(patch);
      return;
    }
    this.roomState = deepMerge(this.roomState, patch);
    this.onRoomState(this.roomState);
  }

  send(data) {
    if (this.room) this.room.send(data);
    else this.onEvent({ ...data, clientId: "local", username: this.identity.username });
  }

  async loadGameState(userId) {
    if (!this.room?.collection || !userId) return this.loadLocalAccount(userId);
    try {
      const result = await this.room.collection(this.saveCollection).filter({ id: userId }).getList();
      const records = Array.isArray(result) ? result : (result?.data || []);
      return records[0] || null;
    } catch (error) {
      console.warn("Cloud save could not be loaded; using the local save.", error);
      return this.loadLocalAccount(userId);
    }
  }

  async saveGameState(userId, state) {
    if (!userId) return false;
    if (!this.room?.collection) return this.saveLocalAccount(userId, state);
    try {
      await this.room.collection(this.saveCollection).upsert({ id: userId, ...state, schemaVersion: this.protocolVersion });
      return true;
    } catch (error) {
      console.warn("Cloud save failed; progress remains saved on this device.", error);
      return this.saveLocalAccount(userId, state);
    }
  }

  loadLocalAccount(userId) {
    try { return userId ? JSON.parse(localStorage.getItem(`pathofpixels:account:${userId}`) || "null") : null; } catch { return null; }
  }

  saveLocalAccount(userId, state) {
    try {
      localStorage.setItem(`pathofpixels:account:${userId}`, JSON.stringify({ id: userId, ...state, schemaVersion: this.protocolVersion }));
      return true;
    } catch { return false; }
  }
}

function deepMerge(target, patch) {
  const result = { ...(target || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === null) {
      delete result[key];
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
