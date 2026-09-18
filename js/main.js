import { BrowserQuest } from "./game.js";

const game = new BrowserQuest();
game.init().catch((error) => {
  console.error(error);
  const loading = document.querySelector("#loading");
  loading.innerHTML = "<span>The realm could not be loaded</span><small>Check the console for details.</small>";
});
