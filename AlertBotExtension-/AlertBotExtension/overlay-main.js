(() => {
    // ==================== IN-PAGE OVERLAY UI (MERGED) ====================
    // Injected directly into the game page. Unlike the toolbar popup, this
    // panel stays open when you click elsewhere and can be dragged anywhere.
    // It does NOT touch any alert/webhook/threshold logic in content1.js / content2.js —
    // it only reads/writes the same chrome.storage.local keys they already expose.
    //
    // This file merges the two overlay variants:
    //  - Quick Attack Setup + Quick Access come from the "overlay2" version (worked there)
    //  - Random Click Highlighted comes from the "overlay" version (worked there)

    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

    const STORAGE_KEYS = {
        attackAlertsEnabled: true,
        foodAlertsEnabled: true,
        attackStatus: null,
        foodStatus: null,
        overlayPosition: null,
        overlayCollapsed: false
    };

    // ---- Build isolated DOM (Shadow DOM keeps game page CSS from bleeding in) ----
    const host = document.createElement("div");
    host.id = "toma-alert-overlay-host";
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647"; // stay above game canvas/UI
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .panel {
            width: 250px;
            background: rgba(20, 21, 26, 0.6);
            backdrop-filter: blur(3px) saturate(140%);
            border: 1px solid rgba(255, 255, 255, 0.09);
            border-radius: 12px;
            color: #eceef2;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            user-select: none;
        }
        .panel.collapsed .body { display: none; }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            background: rgba(29, 31, 38, 0.7);
            cursor: grab;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }
        .header:active { cursor: grabbing; }
        .title-row { display: flex; align-items: center; gap: 6px; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: #5a5d66; flex-shrink: 0; }
        .dot.live { background: #3ddc84; box-shadow: 0 0 6px #3ddc84; }
        .title { font-size: 12px; font-weight: 600; }
        .collapse-btn {
            background: none; border: none; color: #8b8f9c; cursor: pointer;
            font-size: 14px; line-height: 1; padding: 2px 4px;
        }
        .collapse-btn:hover { color: #eceef2; }
        .body { padding: 0; }
        .tab-bar {
            display: flex;
            gap: 4px;
            padding: 8px 8px 0;
            background: rgba(15, 16, 20, 0.25);
        }
        .tab-btn {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid transparent;
            border-bottom: none;
            border-radius: 8px 8px 0 0;
            color: #8b8f9c;
            padding: 6px 4px;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
        }
        .tab-btn .icon { font-size: 14px; width: auto; }
        .tab-btn .tab-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; }
        .tab-btn:hover { color: #eceef2; background: rgba(255, 255, 255, 0.08); }
        .tab-btn.active {
            background: rgba(61, 220, 132, 0.14);
            color: #3ddc84;
            border-color: rgba(61, 220, 132, 0.3);
        }
        .tab-content {
            padding: 10px;
            max-height: 65vh;
            overflow-y: auto;
        }
        .tab-content[hidden] { display: none; }
        .tab-content::-webkit-scrollbar { width: 5px; }
        .tab-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
        .row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 0;
        }
        .label { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .icon { font-size: 15px; width: 18px; text-align: center; }
        .switch { position: relative; display: inline-block; width: 32px; height: 18px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; inset: 0; background-color: rgba(58, 61, 71, 0.85);
            border-radius: 18px; transition: 0.2s; cursor: pointer;
        }
        .slider::before {
            content: ""; position: absolute; height: 14px; width: 14px;
            left: 2px; bottom: 2px; background-color: #eceef2; border-radius: 50%; transition: 0.2s;
        }
        input:checked + .slider { background-color: #3ddc84; }
        input:checked + .slider::before { transform: translateX(14px); }
        .divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 6px 0; }
        .status { font-size: 11px; color: #8b8f9c; line-height: 1.6; }
        .status b { color: #eceef2; font-weight: 600; }
        .updated { font-size: 10px; color: #5a5d66; text-align: right; margin-top: 4px; }
        .qa-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #8b8f9c; margin-bottom: 6px; }
        .qa-target { font-size: 12px; margin-bottom: 8px; }
        .qa-buttons { display: flex; gap: 6px; }
        .qa-btn {
            flex: 1; font-size: 11px; padding: 6px 8px; border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.09); background: rgba(38, 41, 51, 0.75); color: #eceef2; cursor: pointer;
        }
        .qa-btn:hover:not(:disabled) { background: rgba(47, 51, 63, 0.85); }
        .qa-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .qa-feedback { font-size: 10px; color: #3ddc84; margin-top: 6px; min-height: 12px; }
        .th-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .th-row input[type="range"] { flex: 1; }
        .th-number {
            width: 64px; padding: 4px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.09);
            background: rgba(29, 31, 38, 0.75); color: #eceef2; font-size: 11px; text-align: center;
        }
        .th-check { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #8b8f9c; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
        <div class="header" id="drag-handle">
            <div class="title-row">
                <span class="dot" id="live-dot"></span>
                <span class="title">THE FOOL ASSISTANT</span>
            </div>
            <button class="collapse-btn" id="collapse-btn">–</button>
        </div>
        <div class="body">
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="main" title="Main">
                    <span class="icon">📋</span><span class="tab-label">Main</span>
                </button>
               
                <button class="tab-btn" data-tab="effects" title="Effects">
                    <span class="icon">✨</span><span class="tab-label">FX</span>
                </button>
            </div>

            <div class="tab-content" data-tab-content="main">
                <div class="row">
                    <div class="label"><span class="icon">⚔️</span>Attack Alerts</div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-attack" />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="row">
                    <div class="label"><span class="icon">🌾</span>Food Alerts</div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-food" />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="divider"></div>
                <div class="status" id="status-text">Waiting for data…</div>
                <div class="updated" id="updated-text">—</div>
            </div>


            <div class="tab-content" data-tab-content="effects" hidden>
                <div class="qa-title">✨ Upgrade Animation</div>
                <div class="row" style="padding: 2px 0 8px;">
                    <div class="label"><span class="icon">🔨</span>Glow + sparkle + builder</div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-upgrade-anim" checked />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="divider"></div>
                <div class="qa-title">⚔️ Training Animation</div>
                <div class="row" style="padding: 2px 0 8px;">
                    <div class="label"><span class="icon">⚔️</span>Glow + clash on training buildings</div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-training-anim" checked />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="divider"></div>
                <div class="qa-title">⚙️ Crafting Animation</div>
                <div class="row" style="padding: 2px 0 8px;">
                    <div class="label"><span class="icon">⚙️</span>Glow + spinning gear on crafting buildings</div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-crafting-anim" checked />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="divider"></div>
                <div class="qa-title">🚶 Roaming Villagers</div>
                <div class="row" style="padding: 2px 0 8px;">
                    <div class="label"><span class="icon">🚶</span>Walking NPCs with random expressions</div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-roaming-anim" checked />
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        </div>
    `;
    shadow.appendChild(panel);

    const $ = (id) => shadow.getElementById(id);

    // ---- Position: restore saved spot, or default to bottom-right ----
    function applyPosition(pos) {
        const margin = 16;
        const w = 250, h = panel.classList.contains("collapsed") ? 36 : 260;
        let left = pos && typeof pos.left === "number" ? pos.left : window.innerWidth - w - margin;
        let top = pos && typeof pos.top === "number" ? pos.top : window.innerHeight - h - margin;
        left = Math.max(0, Math.min(left, window.innerWidth - 60));
        top = Math.max(0, Math.min(top, window.innerHeight - 30));
        host.style.left = `${left}px`;
        host.style.top = `${top}px`;
    }

    // ---- Dragging ----
    const handle = $("drag-handle");
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

    handle.addEventListener("mousedown", (e) => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(host.style.left, 10) || 0;
        startTop = parseInt(host.style.top, 10) || 0;
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const newLeft = startLeft + (e.clientX - startX);
        const newTop = startTop + (e.clientY - startY);
        host.style.left = `${Math.max(0, Math.min(newLeft, window.innerWidth - 60))}px`;
        host.style.top = `${Math.max(0, Math.min(newTop, window.innerHeight - 30))}px`;
    });

    window.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        const left = parseInt(host.style.left, 10) || 0;
        const top = parseInt(host.style.top, 10) || 0;
        chrome.storage.local.set({ overlayPosition: { left, top } });
    });

    // ---- Collapse / expand ----
    $("collapse-btn").addEventListener("click", () => {
        const collapsed = !panel.classList.contains("collapsed");
        panel.classList.toggle("collapsed", collapsed);
        $("collapse-btn").textContent = collapsed ? "+" : "–";
        chrome.storage.local.set({ overlayCollapsed: collapsed });
    });

    // ---- Tabs (Main / Autopilot / Effects) ----
    const tabButtons = shadow.querySelectorAll(".tab-btn");
    const tabContents = shadow.querySelectorAll(".tab-content");
    function switchTab(tabName) {
        tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
        tabContents.forEach((content) => {
            content.hidden = content.dataset.tabContent !== tabName;
        });
        chrome.storage.local.set({ overlayActiveTab: tabName });
    }
    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    chrome.storage.local.get({ overlayActiveTab: "main" }, (res) => {
        switchTab(res.overlayActiveTab);
    });

    // ---- Toggles (same storage keys content1.js / content2.js already read) ----
    $("toggle-attack").addEventListener("change", (e) => {
        chrome.storage.local.set({ attackAlertsEnabled: e.target.checked });
    });
    $("toggle-food").addEventListener("change", (e) => {
        chrome.storage.local.set({ foodAlertsEnabled: e.target.checked });
    });


    function timeAgo(ts) {
        if (!ts) return "never";
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 5) return "just now";
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    }

    function render(data) {
        $("toggle-attack").checked = data.attackAlertsEnabled !== false;
        $("toggle-food").checked = data.foodAlertsEnabled !== false;

        const attackStatus = data.attackStatus;
        const foodStatus = data.foodStatus;
        const mostRecent = Math.max(attackStatus?.updatedAt || 0, foodStatus?.updatedAt || 0);
        const isLive = mostRecent && (Date.now() - mostRecent < 15000);

        $("live-dot").classList.toggle("live", !!isLive);

        if (!attackStatus && !foodStatus) {
            $("status-text").textContent = "No town data detected yet on this page.";
            $("updated-text").textContent = "—";
            return;
        }

        const name = attackStatus?.name || foodStatus?.name || `Town #${attackStatus?.townId || foodStatus?.townId || "?"}`;
        const incoming = attackStatus?.incomingCount ?? 0;
        const food = foodStatus?.currentFood;
        const threshold = foodStatus?.activeThreshold;

        $("status-text").innerHTML = `
            Ruler: <b>${name}</b><br/>
            Incoming marches: <b>${incoming}</b>
            ${food != null ? `<br/>Food: <b>${food.toLocaleString()} / ${threshold.toLocaleString()}</b>` : ""}
        `;
        $("updated-text").textContent = `Updated ${timeAgo(mostRecent)}`;
    }

    function loadAndRender() {
        chrome.storage.local.get(STORAGE_KEYS, (data) => {
            render(data);
            if (data.overlayCollapsed) {
                panel.classList.add("collapsed");
                $("collapse-btn").textContent = "+";
            }
            applyPosition(data.overlayPosition);
        });
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
            chrome.storage.local.get(STORAGE_KEYS, render);
        }
    });

    window.addEventListener("resize", () => {
        chrome.storage.local.get({ overlayPosition: null }, (d) => applyPosition(d.overlayPosition));
    });

    loadAndRender();


    // Shared handles so autopilot.js and effects.js (loaded after this
    // file — see manifest.json) can find elements inside this panel.
    window.__tomaOverlay = { shadow, $, host, panel };
})();
