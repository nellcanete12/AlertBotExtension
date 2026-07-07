(() => {
    // Depends on overlay-main.js having run first in the same content
    // script (builds the shadow-DOM panel + tabs this file hooks into).
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    const toma = window.__tomaOverlay;
    if (!toma) { console.warn("[Tribes Overlay] overlay-effects.js needs overlay-main.js to run first"); return; }
    const { $ } = toma;

    // ---- Upgrade Animation toggle ----
    let upgradeAnimEnabled = true;
    chrome.storage.local.get({ upgradeAnimationEnabled: true }, (res) => {
        upgradeAnimEnabled = res.upgradeAnimationEnabled;
        $("toggle-upgrade-anim").checked = upgradeAnimEnabled;
    });
    $("toggle-upgrade-anim").addEventListener("change", (e) => {
        upgradeAnimEnabled = e.target.checked;
        chrome.storage.local.set({ upgradeAnimationEnabled: upgradeAnimEnabled });
        if (!upgradeAnimEnabled) scanUpgradeAnimations(); // immediately clear existing effects
    });

    // ---- Training Animation toggle ----
    let trainingAnimEnabled = true;
    chrome.storage.local.get({ trainingAnimationEnabled: true }, (res) => {
        trainingAnimEnabled = res.trainingAnimationEnabled;
        $("toggle-training-anim").checked = trainingAnimEnabled;
    });
    $("toggle-training-anim").addEventListener("change", (e) => {
        trainingAnimEnabled = e.target.checked;
        chrome.storage.local.set({ trainingAnimationEnabled: trainingAnimEnabled });
        if (!trainingAnimEnabled) scanProductionAnimations();
    });

    // ---- Crafting Animation toggle ----
    let craftingAnimEnabled = true;
    chrome.storage.local.get({ craftingAnimationEnabled: true }, (res) => {
        craftingAnimEnabled = res.craftingAnimationEnabled;
        $("toggle-crafting-anim").checked = craftingAnimEnabled;
    });
    $("toggle-crafting-anim").addEventListener("change", (e) => {
        craftingAnimEnabled = e.target.checked;
        chrome.storage.local.set({ craftingAnimationEnabled: craftingAnimEnabled });
        if (!craftingAnimEnabled) scanProductionAnimations();
    });

    let roamingAnimEnabled = true;
    chrome.storage.local.get({ roamingNpcsEnabled: true }, (res) => {
        roamingAnimEnabled = res.roamingNpcsEnabled;
        $("toggle-roaming-anim").checked = roamingAnimEnabled;
    });
    $("toggle-roaming-anim").addEventListener("change", (e) => {
        roamingAnimEnabled = e.target.checked;
        chrome.storage.local.set({ roamingNpcsEnabled: roamingAnimEnabled });
    });

    // ==================== UPGRADE ANIMATION ====================
    // Purely visual: the game already marks a building mid-upgrade with the
    // "is-building" class on its .building-container-container (you can see
    // this yourself — that's the one showing the double-chevron icon in its
    // timer instead of a resource icon). We just add a glow + a bouncing
    // sparkle on top of whichever building(s) currently have that class.
    // Never touches game state, never clicks anything.
    function ensureUpgradeAnimStyleInjected() {
        if (document.getElementById("toma-upgrade-anim-style")) return;
        const s = document.createElement("style");
        s.id = "toma-upgrade-anim-style";
        s.textContent = `
            .toma-upgrading-glow {
                animation: toma-upgrade-pulse 1.4s ease-in-out infinite;
            }
            @keyframes toma-upgrade-pulse {
                0%, 100% { filter: drop-shadow(0 0 3px #ffd54a) drop-shadow(0 0 1px #ffd54a); }
                50% { filter: drop-shadow(0 0 10px #ffd54a) drop-shadow(0 0 4px #fff3c4) brightness(1.2); }
            }
            .toma-upgrade-sparkle {
                position: absolute;
                top: -6px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 14px;
                pointer-events: none;
                z-index: 40000;
                animation: toma-upgrade-bounce 1s ease-in-out infinite;
            }
            @keyframes toma-upgrade-bounce {
                0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.85; }
                50% { transform: translate(-50%, -6px) scale(1.15); opacity: 1; }
            }
            .toma-upgrade-builder, .toma-training-icon, .toma-crafting-icon {
                position: absolute;
                bottom: -3px;
                left: 58%;
                width: 16px;
                height: 24px;
                pointer-events: none;
                z-index: 40001;
            }
            .toma-npc-wrap svg { width: 100%; height: 100%; display: block; overflow: visible; }
            .toma-training-glow {
                animation: toma-training-pulse 1.2s ease-in-out infinite;
            }
            @keyframes toma-training-pulse {
                0%, 100% { filter: drop-shadow(0 0 3px #ff6b6b) drop-shadow(0 0 1px #ff6b6b); }
                50% { filter: drop-shadow(0 0 10px #ff6b6b) drop-shadow(0 0 4px #ffb3b3) brightness(1.15); }
            }
            .toma-crafting-glow {
                animation: toma-crafting-pulse 1.6s ease-in-out infinite;
            }
            @keyframes toma-crafting-pulse {
                0%, 100% { filter: drop-shadow(0 0 3px #4fc3f7) drop-shadow(0 0 1px #4fc3f7); }
                50% { filter: drop-shadow(0 0 10px #4fc3f7) drop-shadow(0 0 4px #b3e5fc) brightness(1.15); }
            }
            .toma-npc-wrap .npc-hat, .toma-npc-wrap .npc-helmet,
            .toma-npc-wrap .npc-bandana, .toma-npc-wrap .npc-anvil,
            .toma-npc-wrap .npc-spark, .toma-npc-wrap .npc-brow { display: none; }
            .toma-npc-wrap .npc-arm-front-group { transform-box: fill-box; transform-origin: 85% 10%; }
            .toma-npc-wrap .npc-eye { fill: #2b2b2b; }
            .toma-npc-wrap .npc-mouth,
            .toma-npc-wrap .npc-brow { fill: none; stroke: #2b2b2b; stroke-width: 0.5; stroke-linecap: round; }

            /* Builder NPC (upgrade) — hard hat, swings a hammer */
            .toma-npc-builder .npc-head, .toma-npc-builder .npc-arm-back,
            .toma-npc-builder .npc-arm-front { fill: #f1c27d; }
            .toma-npc-builder .npc-body { fill: #8d6748; }
            .toma-npc-builder .npc-leg { fill: #4b3423; }
            .toma-npc-builder .npc-tool { fill: #5c5c5c; }
            .toma-npc-builder .npc-hat { display: block; fill: #ffd54a; }
            .toma-npc-builder .npc-arm-front-group {
                animation: toma-npc-hammer-swing 0.6s ease-in-out infinite;
            }
            @keyframes toma-npc-hammer-swing {
                0%, 100% { transform: rotate(-8deg); }
                50% { transform: rotate(58deg); }
            }

            /* Soldier NPC (training) — helmet, swings a sword */
            .toma-npc-soldier .npc-head, .toma-npc-soldier .npc-arm-back,
            .toma-npc-soldier .npc-arm-front { fill: #d8b98a; }
            .toma-npc-soldier .npc-body { fill: #7a2323; }
            .toma-npc-soldier .npc-leg { fill: #2e2e2e; }
            .toma-npc-soldier .npc-tool { fill: #dcdcdc; }
            .toma-npc-soldier .npc-helmet { display: block; fill: #9e9e9e; }
            .toma-npc-soldier .npc-arm-front-group {
                animation: toma-npc-sword-swing 0.7s ease-in-out infinite;
            }
            @keyframes toma-npc-sword-swing {
                0%, 100% { transform: rotate(-28deg); }
                50% { transform: rotate(38deg); }
            }

            /* Crafter NPC (production) — bandana, strikes a small anvil */
            .toma-npc-crafter .npc-head, .toma-npc-crafter .npc-arm-back,
            .toma-npc-crafter .npc-arm-front { fill: #e0b98f; }
            .toma-npc-crafter .npc-body { fill: #2b4a63; }
            .toma-npc-crafter .npc-leg { fill: #1c2e3d; }
            .toma-npc-crafter .npc-tool { fill: #5c5c5c; }
            .toma-npc-crafter .npc-bandana { display: block; fill: #4fc3f7; }
            .toma-npc-crafter .npc-anvil { display: block; fill: #3a3a3a; }
            .toma-npc-crafter .npc-arm-front-group {
                animation: toma-npc-craft-strike 1s ease-in-out infinite;
            }
            @keyframes toma-npc-craft-strike {
                0%, 100% { transform: rotate(0deg); }
                45% { transform: rotate(48deg); }
                55% { transform: rotate(50deg); }
            }
            .toma-npc-crafter .npc-spark {
                display: block;
                animation: toma-npc-spark-flash 1s ease-in-out infinite;
            }
            @keyframes toma-npc-spark-flash {
                0%, 46%, 100% { opacity: 0; }
                50%, 58% { opacity: 1; }
                62% { opacity: 0; }
            }
        `;
        document.head.appendChild(s);
    }

    // Shared little-person figure used by all three animations below — head,
    // body, two legs, a static back arm, and an animated front arm holding
    // whichever tool the CSS above assigns it. Optional hat/helmet/bandana
    // and the anvil+spark (crafter only) are hidden by default and switched
    // on per-type via the CSS classes above.
    const NPC_SVG_MARKUP = `
        <svg viewBox="0 0 16 24" xmlns="http://www.w3.org/2000/svg">
            <rect class="npc-anvil" x="10" y="18" width="6" height="4" rx="1"></rect>
            <rect class="npc-leg npc-leg-l" x="4" y="16" width="3" height="8" rx="1"></rect>
            <rect class="npc-leg npc-leg-r" x="9" y="16" width="3" height="8" rx="1"></rect>
            <rect class="npc-body" x="3" y="7" width="10" height="10" rx="3"></rect>
            <rect class="npc-arm-back" x="1" y="8" width="2.5" height="8" rx="1"></rect>
            <g class="npc-arm-front-group">
                <rect class="npc-arm-front" x="12.5" y="8" width="2.5" height="8" rx="1"></rect>
                <rect class="npc-tool" x="12" y="15" width="6" height="3" rx="1"></rect>
                <circle class="npc-spark" cx="16" cy="18" r="1.4"></circle>
            </g>
            <circle class="npc-head" cx="8" cy="4" r="4"></circle>
            <circle class="npc-eye npc-eye-l" cx="6.3" cy="3.6" r="0.55"></circle>
            <circle class="npc-eye npc-eye-r" cx="9.7" cy="3.6" r="0.55"></circle>
            <path class="npc-brow npc-brow-l" d="M5.1 2.2 L6.9 2.5"></path>
            <path class="npc-brow npc-brow-r" d="M9.1 2.5 L10.9 2.2"></path>
            <path class="npc-mouth" d="M7 5.6 L9 5.6"></path>
            <path class="npc-hat" d="M3.5 1.5 h9 v2.2 h-9 z"></path>
            <path class="npc-helmet" d="M3.7 1 a4.3 4.3 0 0 1 8.6 0 z"></path>
            <rect class="npc-bandana" x="3.6" y="0.6" width="8.8" height="2.2" rx="1"></rect>
        </svg>
    `;

    function createNpcWrapper(wrapperClass, npcTypeClass) {
        const wrap = document.createElement("div");
        wrap.className = `${wrapperClass} toma-npc-wrap ${npcTypeClass}`;
        wrap.innerHTML = NPC_SVG_MARKUP;
        return wrap;
    }

    // "is-building" is normally a stable state class, unaffected by the
    // timer icon itself — but we apply the exact same confirmed-and-cached
    // pattern used for training/crafting below anyway, so the gold glow and
    // builder NPC are just as resilient if that ever changes, and behave
    // consistently with the other two animations.
    const upgradeActivityCache = new Set(); // building-ids confirmed as currently upgrading
    let lastConfirmedUpgradeCount = 0;

    function updateUpgradeCache() {
        const containers = document.querySelectorAll(".building-container-container");
        let confirmedThisScan = 0;
        const confirmedIds = new Set();

        containers.forEach((container) => {
            const id = container.getAttribute("data-building-id");
            if (!id) return;
            if (container.classList.contains("is-building")) {
                upgradeActivityCache.add(id);
                confirmedIds.add(id);
                confirmedThisScan++;
            }
        });

        const likelyGlobalHideToggle = lastConfirmedUpgradeCount > 0 && confirmedThisScan === 0;

        if (!likelyGlobalHideToggle) {
            for (const id of Array.from(upgradeActivityCache)) {
                if (confirmedIds.has(id)) continue;
                const container = document.querySelector(
                    `.building-container-container[data-building-id="${CSS.escape(id)}"]`
                );
                if (!container) {
                    upgradeActivityCache.delete(id); // building no longer on screen at all
                    continue;
                }
                if (!container.classList.contains("is-building")) {
                    upgradeActivityCache.delete(id); // confirmed finished
                }
            }
        }

        // Same reasoning as the production cache below: only advance the
        // baseline on a real positive reading, never on 0, so a frozen
        // cache stays frozen for as long as needed instead of unfreezing
        // itself after a single scan.
        if (confirmedThisScan > 0) {
            lastConfirmedUpgradeCount = confirmedThisScan;
        }
    }

    function scanUpgradeAnimations() {
        updateUpgradeCache();

        document.querySelectorAll(".toma-upgrading-glow, .toma-upgrade-sparkle, .toma-upgrade-builder").forEach((el) => {
            const container = el.closest(".building-container-container");
            const id = container && container.getAttribute("data-building-id");
            const stillUpgrading = upgradeAnimEnabled && id && upgradeActivityCache.has(id);
            if (!stillUpgrading) {
                el.classList.remove("toma-upgrading-glow");
                if (el.classList.contains("toma-upgrade-sparkle") || el.classList.contains("toma-upgrade-builder")) {
                    el.remove();
                }
            }
        });

        if (!upgradeAnimEnabled) return;

        upgradeActivityCache.forEach((id) => {
            const container = document.querySelector(
                `.building-container-container[data-building-id="${CSS.escape(id)}"]`
            );
            if (!container) return;

            const buildingImg = container.querySelector(".building.building-image");
            if (buildingImg && !buildingImg.classList.contains("toma-upgrading-glow")) {
                buildingImg.classList.add("toma-upgrading-glow");
            }

            const innerContainer = container.querySelector(".building-container");
            if (innerContainer && !innerContainer.querySelector(".toma-upgrade-sparkle")) {
                if (!innerContainer.style.position) innerContainer.style.position = "relative";
                const sparkle = document.createElement("div");
                sparkle.className = "toma-upgrade-sparkle";
                sparkle.textContent = "✨";
                innerContainer.appendChild(sparkle);
            }
            if (innerContainer && !innerContainer.querySelector(".toma-upgrade-builder")) {
                if (!innerContainer.style.position) innerContainer.style.position = "relative";
                innerContainer.appendChild(createNpcWrapper("toma-upgrade-builder", "toma-npc-builder"));
            }
        });
    }

    ensureUpgradeAnimStyleInjected();
    setInterval(scanUpgradeAnimations, 1000);

    // ==================== TRAINING / CRAFTING ANIMATION ====================
    // Same idea as the upgrade animation, but for the OTHER timer the game
    // shows on a building: a training_grounds/archery_grounds/barracks
    // producing troops, or a farmer/miner/woodcutter/crafter producing
    // resources. The building's own timer icon tells us which: troop icons
    // load from the game's /populations/ path, resource icons from /items/.
    // A building actively upgrading (is-building) is left to the upgrade
    // animation above so the two never fight over the same building.
    //
    // The icon only exists in the DOM while the game's own "Toggle Building
    // Timers Visibility" option is switched ON. To keep the animation
    // running when that's switched off — instead of it just disappearing —
    // we remember the last CONFIRMED kind per building-id and keep showing
    // it from that memory. We only ever add a building to that memory once
    // we've actually read its icon (never guessed from building type alone),
    // and we only drop it once we can positively confirm it finished: i.e.
    // we can still read that specific building's icon slot and it's empty.
    // If instead every currently-tracked building loses its icon in the same
    // scan, that's a much better fit for "the visibility toggle just got
    // switched off" than "every single one finished in the same second" —
    // so in that case we freeze the memory instead of clearing it.
    const productionActivityCache = new Map(); // buildingId -> "training" | "crafting"
    let lastConfirmedProductionCount = 0;

    function getTimerLayerFor(container) {
        const next = container.nextElementSibling;
        return next && next.classList.contains("building-timer-layer") ? next : null;
    }

    function readIconKind(container) {
        const timerLayer = getTimerLayerFor(container);
        const img = timerLayer ? timerLayer.querySelector("img[src]") : null;
        if (!img) return null;
        const src = img.getAttribute("src") || "";
        if (src.includes("/populations/")) return "training";
        if (src.includes("/items/")) return "crafting";
        return null;
    }

    function updateProductionCache() {
        const containers = document.querySelectorAll(".building-container-container");
        let confirmedThisScan = 0;
        const confirmedIds = new Set();

        containers.forEach((container) => {
            if (container.classList.contains("is-building")) return;
            const id = container.getAttribute("data-building-id");
            if (!id) return;
            const kind = readIconKind(container);
            if (kind) {
                productionActivityCache.set(id, kind);
                confirmedIds.add(id);
                confirmedThisScan++;
            }
        });

        const likelyGlobalHideToggle = lastConfirmedProductionCount > 0 && confirmedThisScan === 0;

        if (!likelyGlobalHideToggle) {
            for (const id of Array.from(productionActivityCache.keys())) {
                if (confirmedIds.has(id)) continue;
                const container = document.querySelector(
                    `.building-container-container[data-building-id="${CSS.escape(id)}"]`
                );
                if (!container) {
                    productionActivityCache.delete(id); // building no longer on screen at all
                    continue;
                }
                if (container.classList.contains("is-building")) continue; // now upgrading; leave memory alone
                if (!readIconKind(container)) {
                    productionActivityCache.delete(id); // confirmed empty on this specific building — it finished
                }
            }
        }

        // Only move the baseline forward when we actually saw something —
        // never overwrite it with 0. If we let it drop to 0 here, the very
        // next scan (still toggled off) would compute
        // lastConfirmedProductionCount(0) > 0 === false, i.e. it would stop
        // treating this as a "visibility just got toggled off" event and
        // would wipe the whole cache one scan later than intended.
        // Keeping the last known non-zero baseline means the freeze holds
        // for as long as the toggle stays off, and resets cleanly the
        // moment icons are confirmed again.
        if (confirmedThisScan > 0) {
            lastConfirmedProductionCount = confirmedThisScan;
        }
    }

    function scanProductionAnimations() {
        updateProductionCache();

        document.querySelectorAll(".toma-training-glow, .toma-training-icon").forEach((el) => {
            const container = el.closest(".building-container-container");
            const id = container && container.getAttribute("data-building-id");
            const stillTraining = trainingAnimEnabled && id && productionActivityCache.get(id) === "training";
            if (!stillTraining) {
                el.classList.remove("toma-training-glow");
                if (el.classList.contains("toma-training-icon")) el.remove();
            }
        });
        document.querySelectorAll(".toma-crafting-glow, .toma-crafting-icon").forEach((el) => {
            const container = el.closest(".building-container-container");
            const id = container && container.getAttribute("data-building-id");
            const stillCrafting = craftingAnimEnabled && id && productionActivityCache.get(id) === "crafting";
            if (!stillCrafting) {
                el.classList.remove("toma-crafting-glow");
                if (el.classList.contains("toma-crafting-icon")) el.remove();
            }
        });

        if (!trainingAnimEnabled && !craftingAnimEnabled) return;

        productionActivityCache.forEach((kind, id) => {
            if (kind === "training" && !trainingAnimEnabled) return;
            if (kind === "crafting" && !craftingAnimEnabled) return;

            const container = document.querySelector(
                `.building-container-container[data-building-id="${CSS.escape(id)}"]`
            );
            if (!container || container.classList.contains("is-building")) return;

            const buildingImg = container.querySelector(".building.building-image");
            const innerContainer = container.querySelector(".building-container");
            const glowClass = kind === "training" ? "toma-training-glow" : "toma-crafting-glow";
            const iconClass = kind === "training" ? "toma-training-icon" : "toma-crafting-icon";
            const npcType = kind === "training" ? "toma-npc-soldier" : "toma-npc-crafter";

            if (buildingImg && !buildingImg.classList.contains(glowClass)) {
                buildingImg.classList.add(glowClass);
            }
            if (innerContainer && !innerContainer.querySelector(`.${iconClass}`)) {
                if (!innerContainer.style.position) innerContainer.style.position = "relative";
                innerContainer.appendChild(createNpcWrapper(iconClass, npcType));
            }
        });
    }

    setInterval(scanProductionAnimations, 1000);

    // ==================== ROAMING VILLAGER NPCS ====================
    // Purely cosmetic: a handful of little figures that wander the empty
    // space of the town grid, each picking a new random spot to stroll to
    // once they arrive at the last one, with a random facial expression
    // assigned when they spawn. Reuses the same NPC_SVG_MARKUP as the
    // building animations above. Never reads or touches game state beyond
    // the town grid's own size, never clicks anything.
    const ROAMING_NPC_COUNT = 3;
    const ROAMING_SPEED_PX_PER_SEC = 16; // in the grid's own unscaled pixel space
    const ROAMING_EXPRESSIONS = ["neutral", "happy", "angry", "surprised", "sleepy"];
    const ROAMING_PALETTES = ["toma-villager-a", "toma-villager-b", "toma-villager-c", "toma-villager-d"];
    let roamingNpcs = [];
    let roamingLastTick = null;

    function ensureRoamingStyleInjected() {
        if (document.getElementById("toma-roaming-npc-style")) return;
        const s = document.createElement("style");
        s.id = "toma-roaming-npc-style";
        s.textContent = `
            .toma-roaming-npc {
                position: absolute;
                width: 16px;
                height: 24px;
                pointer-events: none;
                z-index: 40500;
            }
            .toma-roaming-npc.toma-facing-left { transform: scaleX(-1); }

            /* Villager color variants, picked randomly per spawn for variety */
            .toma-npc-villager .npc-head, .toma-npc-villager .npc-arm-back,
            .toma-npc-villager .npc-arm-front { fill: #e8c39e; }
            .toma-npc-villager.toma-villager-a .npc-body { fill: #6b8e4e; }
            .toma-npc-villager.toma-villager-a .npc-leg { fill: #4b3423; }
            .toma-npc-villager.toma-villager-b .npc-body { fill: #c97b3d; }
            .toma-npc-villager.toma-villager-b .npc-leg { fill: #33475b; }
            .toma-npc-villager.toma-villager-c .npc-body { fill: #7b5ea7; }
            .toma-npc-villager.toma-villager-c .npc-leg { fill: #2e2e2e; }
            .toma-npc-villager.toma-villager-d .npc-body { fill: #b23b5e; }
            .toma-npc-villager.toma-villager-d .npc-leg { fill: #3d3d3d; }

            /* Walking cycle: legs and arms swing in alternating pairs */
            .toma-npc-wrap .npc-leg-l, .toma-npc-wrap .npc-leg-r,
            .toma-npc-wrap .npc-arm-back { transform-box: fill-box; transform-origin: 50% 0%; }
            .toma-walking .npc-leg-l { animation: toma-walk-leg-l 0.5s ease-in-out infinite; }
            .toma-walking .npc-leg-r { animation: toma-walk-leg-r 0.5s ease-in-out infinite; }
            .toma-walking .npc-arm-back { animation: toma-walk-arm-back 0.5s ease-in-out infinite; }
            .toma-walking .npc-arm-front-group { animation: toma-walk-arm-front 0.5s ease-in-out infinite; }
            @keyframes toma-walk-leg-l { 0%, 100% { transform: rotate(20deg); } 50% { transform: rotate(-20deg); } }
            @keyframes toma-walk-leg-r { 0%, 100% { transform: rotate(-20deg); } 50% { transform: rotate(20deg); } }
            @keyframes toma-walk-arm-back { 0%, 100% { transform: rotate(-16deg); } 50% { transform: rotate(16deg); } }
            @keyframes toma-walk-arm-front { 0%, 100% { transform: rotate(16deg); } 50% { transform: rotate(-16deg); } }

            /* Randomized facial expressions, assigned once per spawn */
            .toma-face-happy .npc-mouth { d: path("M6.6 5.3 Q8 6.6 9.4 5.3"); }
            .toma-face-angry .npc-mouth { d: path("M6.6 6.1 Q8 5.3 9.4 6.1"); }
            .toma-face-angry .npc-brow { display: block; }
            .toma-face-angry .npc-brow-l { d: path("M5.1 2.6 L6.9 2.1"); }
            .toma-face-angry .npc-brow-r { d: path("M9.1 2.1 L10.9 2.6"); }
            .toma-face-surprised .npc-mouth { d: path("M7.3 5.2 Q8 5.0 8.7 5.2 Q8.9 6.3 8 6.3 Q7.1 6.3 7.3 5.2 Z"); }
            .toma-face-surprised .npc-brow { display: block; }
            .toma-face-surprised .npc-brow-l { d: path("M5.1 1.9 L6.9 2.3"); }
            .toma-face-surprised .npc-brow-r { d: path("M9.1 2.3 L10.9 1.9"); }
            .toma-face-sleepy .npc-eye { r: 0.15; }
            .toma-face-sleepy .npc-mouth { d: path("M7.3 5.7 Q8 5.9 8.7 5.7"); }
        `;
        document.head.appendChild(s);
    }

    function getRoamingContainer() {
        const grid = document.querySelector(".town-grid-content");
        if (!grid) return null;
        if (!grid.style.position) grid.style.position = "relative"; // so left/top below line up with the tiles
        return grid;
    }

    function randomPointInContainer(container) {
        const w = container.offsetWidth || 800;
        const h = container.offsetHeight || 500;
        const margin = 20;
        return {
            x: margin + Math.random() * Math.max(1, w - margin * 2),
            y: margin + Math.random() * Math.max(1, h - margin * 2),
        };
    }

    function spawnRoamingNpc(container) {
        const expr = ROAMING_EXPRESSIONS[Math.floor(Math.random() * ROAMING_EXPRESSIONS.length)];
        const palette = ROAMING_PALETTES[Math.floor(Math.random() * ROAMING_PALETTES.length)];
        const el = createNpcWrapper("toma-roaming-npc toma-walking", `toma-npc-villager ${palette} toma-face-${expr}`);
        const start = randomPointInContainer(container);
        el.style.left = `${start.x}px`;
        el.style.top = `${start.y}px`;
        container.appendChild(el);
        return { el, x: start.x, y: start.y, target: randomPointInContainer(container), pauseUntil: 0 };
    }

    function pickNewRoamingTarget(npc, container) {
        npc.target = randomPointInContainer(container);
        // Occasionally pause a moment before setting off again so the group
        // doesn't look like it's on rails.
        npc.pauseUntil = Math.random() < 0.3 ? Date.now() + 800 + Math.random() * 1600 : 0;
    }

    function tickRoamingNpcs() {
        const now = Date.now();
        if (roamingLastTick === null) roamingLastTick = now;
        const dt = Math.min(0.25, (now - roamingLastTick) / 1000);
        roamingLastTick = now;

        const container = getRoamingContainer();

        if (!roamingAnimEnabled || !container) {
            if (roamingNpcs.length) {
                roamingNpcs.forEach((npc) => npc.el.remove());
                roamingNpcs = [];
            }
            return;
        }

        // Drop any that got removed by a page re-render, then top back up.
        roamingNpcs = roamingNpcs.filter((npc) => {
            if (npc.el.isConnected) return true;
            return false;
        });
        while (roamingNpcs.length < ROAMING_NPC_COUNT) {
            roamingNpcs.push(spawnRoamingNpc(container));
        }

        roamingNpcs.forEach((npc) => {
            if (now < npc.pauseUntil) return;

            const dx = npc.target.x - npc.x;
            const dy = npc.target.y - npc.y;
            const dist = Math.hypot(dx, dy);
            const step = ROAMING_SPEED_PX_PER_SEC * dt;

            if (dist <= step || dist < 1) {
                npc.x = npc.target.x;
                npc.y = npc.target.y;
                pickNewRoamingTarget(npc, container);
            } else {
                npc.x += (dx / dist) * step;
                npc.y += (dy / dist) * step;
                npc.el.classList.toggle("toma-facing-left", dx < 0);
            }

            npc.el.style.left = `${npc.x}px`;
            npc.el.style.top = `${npc.y}px`;
        });
    }

    ensureRoamingStyleInjected();
    setInterval(tickRoamingNpcs, 50);

})();
