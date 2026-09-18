# Path of Pixels

A pixel-art, browser-based MMORPG built on top of the open-source BrowserQuest engine.

## 🎮 About the Game

**Path of Pixels** brings classic multiplayer role-playing experiences directly to your web browser. Explore an expansive retro world, battle dangerous monsters, collect powerful loot, and team up with players from around the globe instantly with no downloads required.

### Key Features
* ⚔️ **Real-Time Combat:** Fast-paced hack-and-slash multiplayer action.
* 🎒 **Loot & Gear Progression:** Discover rare armor, weapons, and items to build your character.
* 🗺️ **Open-World Exploration:** Traverse diverse pixelated landscapes, dungeons, and safe zones.
* 💬 **Social Systems:** Built-in global chat, player-to-player interactions, and live party mechanics.
* 🌐 **Zero Friction:** Powered entirely by HTML5 and WebSockets for seamless, instant-play browser gaming.

---

## 🚀 Tech Stack

Path of Pixels leverages a robust, low-latency stack inherited and modernized from the original BrowserQuest architecture:

* **Client:** HTML5, Canvas API, CSS3, JavaScript (ES6+)
* **Hosting:** Static HTTP server; no game backend or Redis is included in this port.
* **Networking:** Websim's `WebsimSocket`, when provided by the hosting platform.
* **Data Storage:** Browser local storage, plus Websim account saves when available.

---

## 🛠️ Installation & Setup

Follow these steps to get your own local development instance of Path of Pixels running.

### Prerequisites
For development checks, use Node.js 24 (or a version supported by `package.json`).
To serve the game locally, use Python 3 or another static HTTP server.

### 1. Clone the Repository
```bash
git clone https://github.com/dkskittlesboy-ux/path-of-pixels-new.git
cd path-of-pixels-new
```

### 2. Install Dependencies
Install the development tools; the game itself has no npm runtime dependencies:
```bash
npm install
```

### 3. Run Checks
```bash
npm run lint
npm test
```

### 4. Start the Application
Serve the repository root:
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000`. The client runs directly as ES modules without a build step.
Local hosting supports solo play and saves on this device. Multiplayer and profile saves
require a host that supplies the Websim APIs; publishing to a generic static host does
not supply those APIs.

---

## 📂 Project Structure

```text
├── index.html         # Game page
├── styles.css         # UI styles
├── js/                # Game, world renderer, and Websim bridge
├── data/              # Client and server-format world data
├── assets/img/        # Sprite PNGs, tilesheet, and audio
├── *.json             # Sprite metadata
├── tests/             # Node regression tests
├── package.json       # Development checks
└── README.md          # Project documentation
```

---

## 🗺️ Customization & Modding

Because Path of Pixels is built on BrowserQuest, extending the game is highly accessible:

* **Maps:** World data lives in `data/world_client.json` and `data/world_server.json`.
* **Items & Monsters:** Gameplay tables live in `js/game.js`.
* **Sprites:** PNG sheets live in `assets/img/`; their animation metadata lives in root-level JSON files.

---

## 📜 License & Acknowledgments

* This project is heavily inspired by and built using the original source code of **BrowserQuest**, developed by [Little Workshop](http://littleworkshop.fr) and commissioned by Mozilla.
* BrowserQuest source code is available under the **MPL 2.0 (Mozilla Public License 2.0)**.
* See [CREDITS.md](CREDITS.md), [LICENSE-CODE.txt](LICENSE-CODE.txt), and [LICENSE-ASSETS.txt](LICENSE-ASSETS.txt) for attribution and license notices.
