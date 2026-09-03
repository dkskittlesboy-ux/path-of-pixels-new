export const TILE = 16;
export const CHUNK_SIZE = 16;

// ==========================================
// MAP EXPANSION UTILITY
// ==========================================

/**
 * Expands or resizes the map dimensions and repositions data/collision indices.
 * @param {Object} world - Loaded world object from loadWorld()
 * @param {number} newWidth - New width in tiles
 * @param {number} newHeight - New height in tiles
 * @param {number} offsetX - X offset to shift existing tiles (default 0)
 * @param {number} offsetY - Y offset to shift existing tiles (default 0)
 * @param {number} fillTile - Default tile ID for newly added empty spaces (default 0)
 */
export function expandWorld(world, newWidth, newHeight, offsetX = 0, offsetY = 0, fillTile = 0) {
  const oldWidth = world.map.width;
  const oldHeight = world.map.height;
  const newData = new Array(newWidth * newHeight).fill(fillTile);

  const newBlocked = new Set();
  const newHigh = new Set();
  const newDoors = new Map();

  // 1. Remap 1D Tile Data to New Grid
  for (let y = 0; y < oldHeight; y++) {
    for (let x = 0; x < oldWidth; x++) {
      const targetX = x + offsetX;
      const targetY = y + offsetY;

      if (targetX >= 0 && targetX < newWidth && targetY >= 0 && targetY < newHeight) {
        const oldIndex = y * oldWidth + x;
        const newIndex = targetY * newWidth + targetX;

        newData[newIndex] = world.map.data[oldIndex] ?? fillTile;

        // Remap spatial blocked indices
        if (world.blocked.has(oldIndex)) {
          newBlocked.add(newIndex);
        }
      }
    }
  }

  // 2. Remap Door Coordinates
  for (const [key, door] of world.doors.entries()) {
    const newX = door.x + offsetX;
    const newY = door.y + offsetY;
    if (newX >= 0 && newX < newWidth && newY >= 0 && newY < newHeight) {
      newDoors.set(`${newX},${newY}`, { ...door, x: newX, y: newY });
    }
  }

  // Update map properties in place
  world.map.width = newWidth;
  world.map.height = newHeight;
  world.map.data = newData;
  world.blocked = newBlocked;
  world.doors = newDoors;

  return world;
}

// ==========================================
// DATA LOADING & HELPERS
// ==========================================

export async function loadWorld() {
  const [map, server] = await Promise.all([
    fetch("data/world_client.json").then(checkResponse).then((r) => r.json()),
    fetch("data/world_server.json").then(checkResponse).then((r) => r.json()),
  ]);

  const blocked = new Set([...(map.collisions || []), ...(map.blocking || [])]);
  const doors = new Map();
  for (const door of map.doors || []) doors.set(`${door.x},${door.y}`, door);

  const world = { map, server, blocked, doors, high: new Set(map.high || []) };

  // Example: Programmatically expand map on load if needed (e.g., doubling dimensions to 200x200)
  // expandWorld(world, 200, 200, 20, 20, 1);

  return world;
}

function waitForImage(image) {
  if (typeof image.decode === "function") {
    return image.decode().catch(() => waitForImageLoad(image));
  }
  return waitForImageLoad(image);
}

function waitForImageLoad(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error(`Failed to load image ${image.src}`)), { once: true });
  });
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Failed to load ${response.url}`);
  return response;
}

export function tileIndexToGrid(index, width) {
  const zero = Number(index) - 1;
  return { x: zero % width, y: Math.floor(zero / width) };
}

export function isWalkable(world, x, y) {
  if (x < 1 || y < 1 || x >= world.map.width - 1 || y >= world.map.height - 1) return false;
  const index = y * world.map.width + x;
  return world.doors.has(`${x},${y}`) || !world.blocked.has(index);
}

export function nearestWalkable(world, x, y) {
  if (isWalkable(world, x, y)) return { x, y };
  for (let radius = 1; radius < 12; radius++) {
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        if (Math.abs(ox) !== radius && Math.abs(oy) !== radius) continue;
        if (isWalkable(world, x + ox, y + oy)) return { x: x + ox, y: y + oy };
      }
    }
  }
  return world.server?.spawnPoint || {
    x: Math.floor(world.map.width / 2),
    y: Math.floor(world.map.height / 2),
  };
}

// ==========================================
// SPRITE BANK
// ==========================================

export class SpriteBank {
  constructor() {
    this.configs = new Map();
    this.images = new Map();
  }

  async load(names) {
    await Promise.all(
      [...new Set(names)].map(async (name) => {
        const config = await fetch(`assets/sprites/${name}.json`)
          .then(checkResponse)
          .then((r) => r.json());
        const image = new Image();
        image.src = `assets/img/${name}.png`;
        await waitForImage(image);
        this.configs.set(name, config);
        this.images.set(name, name === "sylvan" ? removeSpriteBackground(image) : image);
      })
    );
  }

  has(name) {
    return this.images.has(name);
  }

  draw(ctx, name, animation, frame, x, y, scale, options = {}) {
    const config = this.configs.get(name);
    const image = this.images.get(name);
    if (!config || !image) return;
    const animations = config.animations || { idle: { length: 1, row: 0 } };
    const anim = animations[animation] || animations.idle || Object.values(animations)[0];
    const length = Math.max(1, anim.length || 1);
    const index = Math.abs(frame) % length;
    const w = config.width;
    const h = config.height;
    const ox = config.offset_x ?? (name === "shadow16" ? 0 : -16);
    const oy = config.offset_y ?? (name === "shadow16" ? 0 : -16);
    ctx.save();
    if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
    if (options.flip) {
      ctx.translate(Math.round((x + TILE) * scale), Math.round(y * scale));
      ctx.scale(-1, 1);
      ctx.drawImage(
        image,
        index * w,
        anim.row * h,
        w,
        h,
        Math.round(ox * scale),
        Math.round(oy * scale),
        w * scale,
        h * scale
      );
    } else {
      ctx.drawImage(
        image,
        index * w,
        anim.row * h,
        w,
        h,
        Math.round((x + ox) * scale),
        Math.round((y + oy) * scale),
        w * scale,
        h * scale
      );
    }
    ctx.restore();
  }
}

function removeSpriteBackground(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const background = [data[0], data[1], data[2]];
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.hypot(data[index] - background[0], data[index + 1] - background[1], data[index + 2] - background[2]);
    if (distance < 72) data[index + 3] = 0;
    else if (distance < 110) data[index + 3] = Math.round(data[index + 3] * (distance - 72) / 38);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

// ==========================================
// OPTIMIZED A* PATHFINDING (MIN-HEAP)
// ==========================================

class PriorityQueue {
  constructor() {
    this.nodes = [];
  }
  push(node) {
    this.nodes.push(node);
    this._bubbleUp(this.nodes.length - 1);
  }
  pop() {
    const top = this.nodes[0];
    const bottom = this.nodes.pop();
    if (this.nodes.length > 0) {
      this.nodes[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }
  get size() {
    return this.nodes.length;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.nodes[i].f >= this.nodes[p].f) break;
      [this.nodes[i], this.nodes[p]] = [this.nodes[p], this.nodes[i]];
      i = p;
    }
  }
  _sinkDown(i) {
    const len = this.nodes.length;
    while (true) {
      let smallest = i;
      const l = (i << 1) + 1;
      const r = l + 1;
      if (l < len && this.nodes[l].f < this.nodes[smallest].f) smallest = l;
      if (r < len && this.nodes[r].f < this.nodes[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.nodes[i], this.nodes[smallest]] = [this.nodes[smallest], this.nodes[i]];
      i = smallest;
    }
  }
}

export function findPath(world, start, goal, maxVisited = 15000) {
  const sx = Math.round(start.x), sy = Math.round(start.y);
  const gx = Math.round(goal.x), gy = Math.round(goal.y);
  if (sx === gx && sy === gy) return [];
  if (!isWalkable(world, gx, gy)) return [];

  const startKey = `${sx},${sy}`;
  const goalKey = `${gx},${gy}`;
  const open = new PriorityQueue();
  open.push({ x: sx, y: sy, f: Math.abs(gx - sx) + Math.abs(gy - sy), g: 0 });

  const scores = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  let visited = 0;

  while (open.size > 0 && visited++ < maxVisited) {
    const current = open.pop();
    const currentKey = `${current.x},${current.y}`;
    if (currentKey === goalKey) {
      const path = [];
      let key = goalKey;
      while (key !== startKey) {
        const [x, y] = key.split(",").map(Number);
        path.unshift({ x, y });
        key = cameFrom.get(key);
      }
      return path;
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx, y = current.y + dy;
      if (!isWalkable(world, x, y)) continue;
      const key = `${x},${y}`;
      const g = current.g + 1;
      if (g >= (scores.get(key) ?? Infinity)) continue;
      scores.set(key, g);
      cameFrom.set(key, currentKey);
      open.push({ x, y, g, f: g + Math.abs(gx - x) + Math.abs(gy - y) });
    }
  }
  return [];
}

// ==========================================
// CHUNK-BASED TILE RENDERER
// ==========================================

export class ChunkManager {
  constructor(world, tileset) {
    this.world = world;
    this.tileset = tileset;
    this.chunks = new Map();
    this.columns = tileset.width / TILE;
  }

  getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) return this.chunks.get(key);

    const canvas = document.createElement("canvas");
    const chunkSizePx = CHUNK_SIZE * TILE;
    canvas.width = chunkSizePx;
    canvas.height = chunkSizePx;
    const ctx = canvas.getContext("2d");

    const map = this.world.map;
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    let hasHigh = false;
    let hasAnim = false;

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      const y = startY + ty;
      if (y >= map.height) break;

      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const x = startX + tx;
        if (x >= map.width) break;

        const value = map.data[y * map.width + x];
        const ids = Array.isArray(value) ? value : [value];

        for (const id of ids) {
          if (!Number.isFinite(id) || id < 1) continue;

          if (this.world.high.has(id)) hasHigh = true;
          if (map.animated?.[id]) {
            hasAnim = true;
            continue;
          }

          const source = id - 1;
          const sx = (source % this.columns) * TILE;
          const sy = Math.floor(source / this.columns) * TILE;
          ctx.drawImage(this.tileset, sx, sy, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }

    const chunkData = { canvas, hasHigh, hasAnim };
    this.chunks.set(key, chunkData);
    return chunkData;
  }

  invalidate(cx, cy) {
    this.chunks.delete(`${cx},${cy}`);
  }

  clear() {
    this.chunks.clear();
  }
}

export function drawWorldTiles(ctx, world, tileset, camera, viewport, scale, highPass, now, chunkManager) {
  if (!chunkManager) {
    drawWorldTilesLegacy(ctx, world, tileset, camera, viewport, scale, highPass, now);
    return;
  }

  const { map } = world;
  const chunkPx = CHUNK_SIZE * TILE * scale;

  const minChunkX = Math.max(0, Math.floor(camera.x / chunkPx));
  const minChunkY = Math.max(0, Math.floor(camera.y / chunkPx));
  const maxChunkX = Math.min(Math.ceil(map.width / CHUNK_SIZE) - 1, Math.ceil((camera.x + viewport.width) / chunkPx));
  const maxChunkY = Math.min(Math.ceil(map.height / CHUNK_SIZE) - 1, Math.ceil((camera.y + viewport.height) / chunkPx));

  const columns = chunkManager.columns;
  const tileSize = TILE * scale;

  if (!highPass) {
    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        const chunk = chunkManager.getChunk(cx, cy);
        const dx = Math.round(cx * chunkPx - camera.x);
        const dy = Math.round(cy * chunkPx - camera.y);
        ctx.drawImage(chunk.canvas, 0, 0, CHUNK_SIZE * TILE, CHUNK_SIZE * TILE, dx, dy, chunkPx, chunkPx);
      }
    }
  }

  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const chunk = chunkManager.getChunk(cx, cy);

      if (highPass && !chunk.hasHigh) continue;
      if (!highPass && !chunk.hasAnim) continue;

      const startX = cx * CHUNK_SIZE;
      const startY = cy * CHUNK_SIZE;
      const endX = Math.min(map.width - 1, startX + CHUNK_SIZE - 1);
      const endY = Math.min(map.height - 1, startY + CHUNK_SIZE - 1);

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const value = map.data[y * map.width + x];
          const ids = Array.isArray(value) ? value : [value];

          for (let id of ids) {
            if (!Number.isFinite(id) || id < 1) continue;

            const isHigh = world.high.has(id);
            if (isHigh !== highPass) continue;

            const anim = map.animated?.[id];
            if (!highPass && !anim) continue;

            if (anim) id += Math.floor(now / (anim.d || 100)) % anim.l;

            const source = id - 1;
            const sx = (source % columns) * TILE;
            const sy = Math.floor(source / columns) * TILE;

            ctx.drawImage(
              tileset,
              sx,
              sy,
              TILE,
              TILE,
              Math.round(x * tileSize - camera.x),
              Math.round(y * tileSize - camera.y),
              tileSize,
              tileSize
            );
          }
        }
      }
    }
  }
}

function drawWorldTilesLegacy(ctx, world, tileset, camera, viewport, scale, highPass, now) {
  const { map } = world;
  const tileSize = TILE * scale;
  const minX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
  const minY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
  const maxX = Math.min(map.width - 1, Math.ceil((camera.x + viewport.width) / tileSize) + 1);
  const maxY = Math.min(map.height - 1, Math.ceil((camera.y + viewport.height) / tileSize) + 1);
  const columns = tileset.width / TILE;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const value = map.data[y * map.width + x];
      const ids = Array.isArray(value) ? value : [value];
      for (let id of ids) {
        if (!Number.isFinite(id) || id < 1) continue;
        const isHigh = world.high.has(id);
        if (isHigh !== highPass) continue;
        const anim = map.animated?.[id];
        if (anim) id += Math.floor(now / (anim.d || 100)) % anim.l;
        const source = id - 1;
        const sx = (source % columns) * TILE;
        const sy = Math.floor(source / columns) * TILE;
        ctx.drawImage(
          tileset,
          sx,
          sy,
          TILE,
          TILE,
          Math.round(x * tileSize - camera.x),
          Math.round(y * tileSize - camera.y),
          tileSize,
          tileSize
        );
      }
    }
  }
}