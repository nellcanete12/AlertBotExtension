(() => {
    // ==================== CONFIGURATION ====================
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1521500890362679297/V_RTREZp9pOTHwZzQovvRfAnfEKBxPwoofTb8jVb6UqgFtpRUG7W0T_X7uukAhBCc7vp";
    
    // Global fallback rule for unlisted profiles
    const DEFAULT_ALERT_THRESHOLD = 100000; 
    const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 1 Hour in milliseconds

    // DIRECT TOWN ID MAP WITH CUSTOM THRESHOLD MODIFIERS
    const TOWN_PLAYER_MAP = {
        "11798": { name: "Havoc-",  discordId: "1129635423182929960", threshold: 100000 },
        "16061": { name: "Havoc_1", discordId: "1129635423182929960", threshold: 100000 },
        "17909": { name: "Havoc_2", discordId: "1129635423182929960", threshold: 100000 },
        "19931": { name: "Havoc_3", discordId: "1129635423182929960", threshold: 100000 },
        "13334": { name: "zev",     discordId: "725809758589681685",  threshold: 500000 },
        "5178": { name: "Real_Ja", discordId: "1255720705350172723", threshold: 800000 },
        "6054": { name: "Exzy-Ja", discordId: "1255720705350172723", threshold: 800000 },
        "12049": { name: "Balkir", discordId: "714120614713229363", threshold: 500000 },
        "19065": { name: "Faye", discordId: "714120614713229363", threshold: 100000 },
        "8203": { name: "Audio", discordId: "360733974105948161", threshold: 800000 },
        "9490": { name: "Sabbiah", discordId: "997865636174766120", threshold: 700000 },
        "13103": { name: "silakbo", discordId: "997865636174766120", threshold: 25000 },
        "11331": { name: "Katinko", discordId: "997865636174766120", threshold: 100000 },
        "16212": { name: "TagaPaslang", discordId: "997865636174766120", threshold: 200000 },
        "12169": { name: "TATPITWU1", discordId: "594702700680183808", threshold: 250000 },
        "36355": { name: "Origin", discordId: "1326191764419252265", threshold: 300000 },
        "17165": { name: "PopTarts", discordId: "1516845159956877402", threshold: 500000 }
    };
    // =======================================================

    const lastAlertTimes = new Map();

    // FIXED: Now extracts Town ID from pathname OR search string parameters to guarantee data captures
    function getTownId() {
        try {
            const urlObj = new URL(window.location.href);
            let match = urlObj.pathname.match(/\/(\d+)/);
            if (!match) {
                match = urlObj.search.match(/[=\/](\d+)/);
            }
            return match ? match[1] : "UNKNOWN";
        } catch (e) {
            return "UNKNOWN";
        }
    }

    function getProfileIdentity() {
        const townId = getTownId();
        return TOWN_PLAYER_MAP[townId] || null; 
    }

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

    function dispatchFoodAlert(playerInfo, currentFood, activeThreshold, townId) {
        // Fallbacks if playerInfo configuration is missing but the townId was extracted
        const targetDiscordId = playerInfo ? playerInfo.discordId : "1129635423182929960";
        const targetName = playerInfo ? playerInfo.name : `Unregistered Town (#${townId})`;
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

        // FIXED: Don't entirely drop out if playerInfo is null. Only kill processing if food scraping fails.
        if (currentFood === null) {
            return;
        }

        // Determine dynamic threshold configuration limits
        const activeThreshold = (playerInfo && playerInfo.threshold) ? playerInfo.threshold : DEFAULT_ALERT_THRESHOLD;

        if (currentFood < activeThreshold) {
            const now = Date.now();
            
            // Use townId string or tracking signature fallback for cooldown mapping index
            const trackingIndexKey = townId !== "UNKNOWN" ? townId : (playerInfo ? playerInfo.name : "UNKNOWN_GLOBAL");
            const lastAlertTime = lastAlertTimes.get(trackingIndexKey) || 0;

            if (now - lastAlertTime > COOLDOWN_DURATION_MS) {
                dispatchFoodAlert(playerInfo, currentFood, activeThreshold, townId);
                lastAlertTimes.set(trackingIndexKey, now);
            }
        } else {
            const trackingIndexKey = townId !== "UNKNOWN" ? townId : (playerInfo ? playerInfo.name : "UNKNOWN_GLOBAL");
            if (lastAlertTimes.has(trackingIndexKey)) {
                 lastAlertTimes.delete(trackingIndexKey);
            }
        }
    }

    const foodObserver = new MutationObserver(() => {
        processSystemScan();
    });

    foodObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    console.log("Defensive Core Framework V8.2 - Deep Scan Town Resolution Active.");
})();