const attackToggle = document.getElementById("toggle-attack");
const foodToggle = document.getElementById("toggle-food");
const attackSub = document.getElementById("attack-sub");
const foodSub = document.getElementById("food-sub");
const townInfo = document.getElementById("town-info");
const lastUpdated = document.getElementById("last-updated");
const liveDot = document.getElementById("live-dot");

function timeAgo(ts) {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function render(data) {
  const attackEnabled = data.attackAlertsEnabled !== false;
  const foodEnabled = data.foodAlertsEnabled !== false;

  attackToggle.checked = attackEnabled;
  foodToggle.checked = foodEnabled;
  attackSub.textContent = attackEnabled ? "Watching for incoming marches" : "Paused";
  foodSub.textContent = foodEnabled ? "Watching food reserves" : "Paused";

  const attackStatus = data.attackStatus;
  const foodStatus = data.foodStatus;
  const mostRecent = Math.max(attackStatus?.updatedAt || 0, foodStatus?.updatedAt || 0);

  const isLive = mostRecent && (Date.now() - mostRecent < 15000);
  liveDot.style.background = isLive ? "#3ddc84" : "#5a5d66";
  liveDot.style.boxShadow = isLive ? "0 0 6px #3ddc84" : "none";

  if (!attackStatus && !foodStatus) {
    townInfo.textContent = "Open a town page on tribesofmalaya.com to see live data.";
    lastUpdated.textContent = "—";
    return;
  }

  const name = attackStatus?.name || foodStatus?.name || `Town #${attackStatus?.townId || foodStatus?.townId || "?"}`;
  const incoming = attackStatus?.incomingCount ?? 0;
  const food = foodStatus?.currentFood;
  const threshold = foodStatus?.activeThreshold;

  townInfo.innerHTML = `
    <div class="row"><span>Ruler</span><span>${name}</span></div>
    <div class="row"><span>Incoming marches</span><span>${incoming}</span></div>
    ${food != null ? `<div class="row"><span>Food</span><span>${food.toLocaleString()} / ${threshold.toLocaleString()}</span></div>` : ""}
  `;

  lastUpdated.textContent = `Last updated ${timeAgo(mostRecent)}`;
}

function loadAndRender() {
  chrome.storage.local.get(
    { attackAlertsEnabled: true, foodAlertsEnabled: true, attackStatus: null, foodStatus: null },
    render
  );
}

attackToggle.addEventListener("change", () => {
  chrome.storage.local.set({ attackAlertsEnabled: attackToggle.checked });
});

foodToggle.addEventListener("change", () => {
  chrome.storage.local.set({ foodAlertsEnabled: foodToggle.checked });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") loadAndRender();
});

loadAndRender();
setInterval(loadAndRender, 3000);
