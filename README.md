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
* **Server:** Node.js
* **Networking:** WebSockets (`ws` library) for real-time bi-directional communication
* **Data Storage:** Redis (for session data, player state, and world persistence)

---

## 🛠️ Installation & Setup

Follow these steps to get your own local development instance of Path of Pixels running.

### Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org) (v16.x or higher recommended)
* [Redis Server](https://redis.io) (Running on its default port `6379`)

### 1. Clone the Repository
```bash
git clone https://github.com
cd path-of-pixels
```

### 2. Install Dependencies
Install the required packages for both the server and client components:
```bash
npm install
```

### 3. Configure the Environment
Copy the example configuration file and adjust the settings (such as ports, database credentials, and game variables) to match your local setup:
```bash
cp server/config.example.json server/config.json
```

### 4. Start the Application
Make sure your Redis server is running, then start the game server:
```bash
npm start
```
By default, the client will be accessible in your browser at `http://localhost:8000` (or the custom port specified in your configuration file).

---

## 📂 Project Structure

```text
├── client/            # Frontend assets (Sprites, UI layout, audio, web client logic)
├── server/            # Backend engine (Game loops, map processing, player sessions, combat mechanics)
├── shared/            # Shared codebase used by both client and server (Enums, map boundaries, math helpers)
├── tools/             # Map compilation utilities and sprite generation scripts
├── package.json       # Project dependencies and script shortcuts
└── README.md          # Project documentation
```

---

## 🗺️ Customization & Modding

Because Path of Pixels is built on BrowserQuest, extending the game is highly accessible:

* **Maps:** Design new worlds using the [Tiled Map Editor](https://mapeditor.org). Export maps to JSON and compile them using the built-in scripts inside the `tools/` directory.
* **Items & Monsters:** Modify JSON configuration files inside `server/js/` to easily add new weapons, armor types, and enemy spawn rates.
* **Sprites:** Swap out PNG sheets inside `client/img/` to change character layouts, weapon visuals, and environmental tiles.

---

## 📜 License & Acknowledgments

* This project is heavily inspired by and built using the original source code of **BrowserQuest**, developed by [Little Workshop](http://littleworkshop.fr) and commissioned by Mozilla.
* BrowserQuest source code is available under the **MPL 2.0 (Mozilla Public License 2.0)**.
* Modifications, custom assets, and game systems specific to *Path of Pixels* are licensed under the [MIT License](LICENSE).
