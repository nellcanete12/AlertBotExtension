(() => {
    // ==================== CONFIGURATION ====================
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1522251082007445626/g64JLKoA_Qs6HpVyZ18uiD-60CZdrSJ2t1q809LSsJIoJLwwPhO5AC7WiEvywS8DmMDV";
    const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 1 Hour cooldown for recurring lock alerts

    // DIRECT TOWN ID MAP
    const TOWN_PLAYER_MAP = {
        "11798": { name: "Havoc", discordId: "1129635423182929960" },
        "16061": { name: "Havoc_1", discordId: "1129635423182929960" },
        "17909": { name: "Havoc_2", discordId: "1129635423182929960" },
        "19931": { name: "Havoc_3", discordId: "1129635423182929960" },
        "13334": { name: "zev", discordId: "725809758589681685" },
        "5178": { name: "Real_Ja", discordId: "1255720705350172723" },
        "6054": { name: "Exzy-Ja", discordId: "1255720705350172723" },
        "12049": { name: "Balkir", discordId: "714120614713229363" },
        "19065": { name: "Faye", discordId: "714120614713229363" },
        "8203": { name: "Audio", discordId: "360733974105948161" },
        "9490": { name: "Sabbiah", discordId: "997865636174766120" },
        "13103": { name: "silakbo", discordId: "997865636174766120" },
        "11331": { name: "Katinko", discordId: "997865636174766120" },
        "16212": { name: "TagaPaslang", discordId: "997865636174766120" },
        "12169": { name: "TATPITWU1", discordId: "594702700680183808" },
        "12464": { name: "Origin", discordId: "1326191764419252265" },
        "17165": { name: "PopTarts", discordId: "1516845159956877402" }
    };

    function isAccountLocked() {
        const pageText = document.body.innerText || "";
        if (pageText.includes("Account temporary locked")) {
            return true;
        }
        const lockIcon = document.querySelector('img[alt*="locked" i], img[title*="locked" i]');
        if (lockIcon) {
            return true;
        }
        return false;
    }
    // =======================================================

    // Trackers for system logic states
    const lastAlertTimes = new Map();
    const lockStartTimes = new Map(); // Stores timestamp when a lock is first detected
    const activeLockStates = new Map(); // Tracks whether a town is currently considered locked

    function getTownId() {
        try {
            const urlObj = new URL(window.location.href);
            let match = urlObj.pathname.match(/\/(\d+)/);
            if (!match) match = urlObj.search.match(/[=\/](\d+)/);
            return match ? match[1] : "UNKNOWN";
        } catch (e) { return "UNKNOWN"; }
    }

    function getProfileIdentity() {
        return TOWN_PLAYER_MAP[getTownId()] || null; 
    }

    function formatDuration(ms) {
        if (ms <= 0) return "Unknown";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    }

    function sendDiscordPayload(payload) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .catch(err => console.error("Webhook processing block error:", err));
    }

    function dispatchLockAlert(playerInfo, townId) {
        const targetDiscordId = playerInfo ? playerInfo.discordId : "1129635423182929960";
        const targetName = playerInfo ? playerInfo.name : `Unregistered Town (#${townId})`;
        const mentionToken = `<@${targetDiscordId}>`;

        const payload = {
            "content": `🚨 ${mentionToken} **SECURITY ALERT: ACCOUNT TEMPORARILY LOCKED!**`,
            "username": "Security Monitor",
            "avatar_url": "https://images.tribesofmalaya.com/items/shield-v1.png",
            "embeds": [{
                "title": "🔒 SECURITY DETECTED: LOCKED 🔒",
                "description": `An 'Account temporary locked' status has been activated on your domain.`,
                "color": 16515843, // Crimson Red
                "fields": [
                    { "name": "👑 Domain Ruler", "value": `\`${targetName}\``, "inline": true },
                    { "name": "🏰 Town ID", "value": `\`${townId}\``, "inline": true },
                    { "name": "⏱️ Time of Incident", "value": `<t:${Math.floor(Date.now() / 1000)}:T>`, "inline": false }
                ],
                "timestamp": new Date().toISOString()
            }]
        };
        sendDiscordPayload(payload);
    }

    function dispatchUnlockAlert(playerInfo, townId, durationMs) {
        const targetDiscordId = playerInfo ? playerInfo.discordId : "1129635423182929960";
        const targetName = playerInfo ? playerInfo.name : `Unregistered Town (#${townId})`;
        const mentionToken = `<@${targetDiscordId}>`;
        const readableDuration = formatDuration(durationMs);

        const payload = {
            "content": `✅ ${mentionToken} **SECURITY UPDATE: LOCK CLEARED!**`,
            "username": "Security Monitor",
            "avatar_url": "https://images.tribesofmalaya.com/items/shield-v1.png",
            "embeds": [{
                "title": "🔓 SECURITY STATUS: RESTORED 🔓",
                "description": `The 'Account temporary locked' buff has vanished. Your domain is clear.`,
                "color": 3066993, // Emerald Green
                "fields": [
                    { "name": "👑 Domain Ruler", "value": `\`${targetName}\``, "inline": true },
                    { "name": "🏰 Town ID", "value": `\`${townId}\``, "inline": true },
                    { "name": "⏳ Total Lock Duration", "value": `\`${readableDuration}\``, "inline": false },
                    { "name": "⏱️ Time Cleared", "value": `<t:${Math.floor(Date.now() / 1000)}:T>`, "inline": false }
                ],
                "timestamp": new Date().toISOString()
            }]
        };
        sendDiscordPayload(payload);
    }

    function processSystemScan() {
        const townId = getTownId();
        const playerInfo = getProfileIdentity(); 
        const lockedActive = isAccountLocked();
        
        const trackingIndexKey = townId !== "UNKNOWN" ? townId : (playerInfo ? playerInfo.name : "UNKNOWN_GLOBAL");
        const wasPreviouslyLocked = activeLockStates.get(trackingIndexKey) || false;

        if (lockedActive) {
            const now = Date.now();
            
            // If this is a brand new lock detection, record the initial start time
            if (!wasPreviouslyLocked) {
                activeLockStates.set(trackingIndexKey, true);
                lockStartTimes.set(trackingIndexKey, now);
            }

            const lastAlertTime = lastAlertTimes.get(trackingIndexKey) || 0;

            // Trigger alert if it's the first run or if cooldown expired
            if (now - lastAlertTime > COOLDOWN_DURATION_MS) {
                dispatchLockAlert(playerInfo, townId);
                lastAlertTimes.set(trackingIndexKey, now);
            }
        } else {
            // If the account is clean but it was locked during the previous check, fire the vanished alert
            if (wasPreviouslyLocked) {
                const now = Date.now();
                const startTime = lockStartTimes.get(trackingIndexKey) || now;
                const durationMs = now - startTime;

                dispatchUnlockAlert(playerInfo, townId, durationMs);

                // Clean up states for this town
                activeLockStates.set(trackingIndexKey, false);
                lockStartTimes.delete(trackingIndexKey);
                lastAlertTimes.delete(trackingIndexKey);
            }
        }
    }

    // Run an initial check immediately when code executes
    processSystemScan();

    // Watch for dynamic DOM modifications (e.g. buffs appearing/disappearing)
    const securityObserver = new MutationObserver(() => {
        processSystemScan();
    });

    securityObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    console.log("Security Framework Core V9.5 - Dual-State Lock & Unlock Scan Active.");
})();