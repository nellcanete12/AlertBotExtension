(() => {
    // ==================== CONFIGURATION ====================
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1521500890362679297/V_RTREZp9pOTHwZzQovvRfAnfEKBxPwoofTb8jVb6UqgFtpRUG7W0T_X7uukAhBCc7vp";
    
    // Global fallback rule for unlisted profiles
    const DEFAULT_ALERT_THRESHOLD = 100000; 
    const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 1 Hour in milliseconds

    // DIRECT TOWN ID MAP WITH CUSTOM THRESHOLD MODIFIERS
    const TOWN_PLAYER_MAP = {
        "11798": { name: "Havoc-",  discordId: "1129635423182929960", threshold: 500000 },
        "16061": { name: "Havoc_1", discordId: "1129635423182929960", threshold: 100000 },
        "17909": { name: "Havoc_2", discordId: "1129635423182929960", threshold: 100000 },
        "19931": { name: "Havoc_3", discordId: "1129635423182929960", threshold: 100000 },
        "13334": { name: "zev",     discordId: "725809758589681685",  threshold: 500000 },
        "5178":  { name: "Real_Ja", discordId: "1255720705350172723", threshold: 800000 },
        "6054":  { name: "Exzy-Ja", discordId: "1255720705350172723", threshold: 800000 },
        "12049":  { name: "Balkir", discordId: "714120614713229363", threshold: 500000 },
        "19065":  { name: "Faye", discordId: "714120614713229363", threshold: 100000 },
        "8203":  { name: "Audio", discordId: "360733974105948161", threshold: 800000 },
        "9490":  { name: "Sabbiah", discordId: "997865636174766120", threshold: 700000 },
        "12169":  { name: "TATPITWU1", discordId: "594702700680183808", threshold: 250000 }
    };
    // =======================================================

    // Advanced Tracking Layers - Tracks last alert timestamp per Town ID
    const lastAlertTimes = new Map();

    // ==================== UI TOGGLE SUPPORT (added, does not touch alert logic) ====================
    let foodAlertsEnabled = true;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ foodAlertsEnabled: true }, (res) => {
            foodAlertsEnabled = res.foodAlertsEnabled;
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.foodAlertsEnabled) {
                foodAlertsEnabled = changes.foodAlertsEnabled.newValue;
            }
        });
    }
    // ================================================================================================

    // Extracts ONLY the pure numeric Town ID from active URL strings, ignoring text parameters
    function getTownId() {
        try {
            const urlObj = new URL(window.location.href);
            const match = urlObj.pathname.match(/\/(\d+)/);
            return match ? match[1] : "UNKNOWN";
        } catch (e) {
            return "UNKNOWN";
        }
    }

    // Maps the Town ID back to your integrated profiles, returns null if unregistered
    function getProfileIdentity() {
        const townId = getTownId();
        if (TOWN_PLAYER_MAP[townId]) {
            return TOWN_PLAYER_MAP[townId];
        }
        return null; // Explicitly flag unregistered towns
    }

    // Scrapes raw text elements for the current exact food inventory calculation
    function getCurrentFoodCount() {
        const foodElement = document.querySelector('div[data-tutorial-target="resource_food"]');
        if (foodElement) {
            const rawText = foodElement.innerText.trim();
            const cleanNumberString = rawText.replace(/,/g, '').replace(/\s/g, '');
            const foodCount = parseInt(cleanNumberString, 10);
            return !isNaN(foodCount) ? foodCount : null;
        }
        return null; 
    }

    function sendDiscordPayload(payload) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .catch(err => console.error("Webhook processing block error:", err));
    }

    function dispatchFoodAlert(playerInfo, currentFood, activeThreshold) {
        const targetDiscordId = playerInfo ? playerInfo.discordId : "1129635423182929960";
        const targetName = playerInfo ? playerInfo.name : "Unregistered Town";
        const mentionToken = `<@${targetDiscordId}>`;

        const payload = {
            "content": `🌾 ${mentionToken} **EMERGENCY: LOW FOOD!**`,
            "username": "Food Monitor",
            "avatar_url": "https://images.tribesofmalaya.com/items/food-v5-x32.png",
            "embeds": [{
                "title": "🌾 RISK OF FAMINE 🌾",
                "description": `Food reserves are dangerously low for your domain! This alert will now enter a 1-hour cooldown for this town.`,
                "color": 15105570, 
                "fields": [
                    { "name": "👑 Ruler", "value": `\`${targetName}\``, "inline": true },
                    { "name": "🌾 Food Count Remaining", "value": `**${currentFood.toLocaleString()}** / ${activeThreshold.toLocaleString()}`, "inline": false }
                ],
                "timestamp": new Date().toISOString()
            }]
        };
        sendDiscordPayload(payload);
    }

    function processSystemScan() {
        const townId = getTownId();
        const playerInfo = getProfileIdentity(); 
        const currentFood = getCurrentFoodCount();

        // If we can't resolve the town or the food count, skip processing
        if (townId === "UNKNOWN" || playerInfo === null || currentFood === null) {
            return;
        }

        // Determine the dynamic threshold rule for this specific scan profile
        const activeThreshold = playerInfo.threshold ? playerInfo.threshold : DEFAULT_ALERT_THRESHOLD;

        // Push live status to storage so the popup UI can display it (added, read-only side effect)
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                foodStatus: {
                    townId,
                    name: playerInfo.name,
                    currentFood,
                    activeThreshold,
                    updatedAt: Date.now()
                }
            });
        }

        // UI gate: if the user has disabled Food Alerts from the popup, skip dispatching (added, does not alter thresholds/logic)
        if (!foodAlertsEnabled) {
            return;
        }

        if (currentFood < activeThreshold) {
            const now = Date.now();
            const lastAlertTime = lastAlertTimes.get(townId) || 0;

            // Check if 1 hour (COOLDOWN_DURATION_MS) has passed since this specific town's last notification
            if (now - lastAlertTime > COOLDOWN_DURATION_MS) {
                dispatchFoodAlert(playerInfo, currentFood, activeThreshold);
                lastAlertTimes.set(townId, now); // Pin the new alert timestamp
            }
        } else {
            // Optional optimization: Clear the cooldown entry entirely if food goes back above threshold
            // Remove this if you want a strict 1-hour limit even if they briefly gather food and dip again
            if (lastAlertTimes.has(townId)) {
                 lastAlertTimes.delete(townId);
            }
        }
    }

    // Core Observer Event Loop Engine - Safely isolated instance name
    const foodObserver = new MutationObserver(() => {
        processSystemScan();
    });

    foodObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    console.log("Defensive Core Framework V8.1 - Hourly Per-Town Cooldowns Active.");
})();