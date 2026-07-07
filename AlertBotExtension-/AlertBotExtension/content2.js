(() => {
    // ==================== CONFIGURATION ====================
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1521490109416083467/QEto3Z0vOATagffhK-RQGpR-hfNGwYHoaBqBTvCZ3Gr0dDDlfGoWRyr5Nt0ZtSENCIgR";

    // DIRECT TOWN ID MAP (Ignores server completely)
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
        "12169": { name: "TATPITWU1", discordId: "594702700680183808" }
    };
    // =======================================================

    /** * Active March Registry */
    // Keeps unique tracking keys locked until the attack lands to prevent duplicate notifications
    const activeMarchRegistry = new Map();
    const activeLandWatchers = new Set(); 

    // ==================== UI TOGGLE SUPPORT (added, does not touch alert logic) ====================
    let attackAlertsEnabled = true;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ attackAlertsEnabled: true }, (res) => {
            attackAlertsEnabled = res.attackAlertsEnabled;
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.attackAlertsEnabled) {
                attackAlertsEnabled = changes.attackAlertsEnabled.newValue;
            }
        });
    }
    // ================================================================================================

    // Extracts ONLY the numeric Town ID from the current page URL
    function getTownId() {
        try {
            const urlObj = new URL(window.location.href);
            const match = urlObj.pathname.match(/\/(\d+)/);
            return match ? match[1] : "UNKNOWN";
        } catch (e) {
            return "UNKNOWN";
        }
    }

    function getProfileIdentity() {
        const townId = getTownId();
        if (TOWN_PLAYER_MAP[townId]) {
            return TOWN_PLAYER_MAP[townId];
        }
        return null; 
    }

    function parseTimeToSeconds(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            if (!isNaN(minutes) && !isNaN(seconds)) {
                return (minutes * 60) + seconds;
            }
        }
        const numericMinutes = parseInt(timeStr, 10);
        return !isNaN(numericMinutes) ? numericMinutes * 60 : 0;
    }

    function scanForAttacks() {
        const detectedAttacks = [];
        const spans = document.querySelectorAll('span');
        for (let span of spans) {
            if (span.innerText.includes("Incoming Attack")) {
                const rawText = span.innerText.trim();
                
                const attackerMatch = rawText.match(/\(([^)]+)\)/);
                const attacker = attackerMatch ? attackerMatch[1].trim() : "Unknown Aggressor";
                
                const parentText = span.parentElement ? span.parentElement.innerText : rawText;
                const timeMatch = parentText.match(/(\d+:\d+)/);
                const totalSeconds = timeMatch ? parseTimeToSeconds(timeMatch[1]) : 0;

                detectedAttacks.push({ attacker, totalSeconds, rawDisplay: rawText });
            }
        }
        return detectedAttacks;
    }

    function sendDiscordPayload(payload) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .catch(err => console.error("Webhook processing error:", err));
    }

    function dispatchAttackAlert(playerInfo, attacker, totalSeconds, landEpochMs) {
        const landEpochSeconds = Math.floor(landEpochMs / 1000);
        const townId = getTownId();

        const etaDate = new Date(landEpochMs);
        let hours = etaDate.getHours();
        const minutes = String(etaDate.getMinutes()).padStart(2, '0');
        const seconds = String(etaDate.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        const formattedETA = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

        const targetDiscordId = playerInfo ? playerInfo.discordId : "1129635423182929960";
        const targetName = playerInfo ? playerInfo.name : `Unregistered Town (#${townId})`;
        const mentionToken = `<@${targetDiscordId}>`;

        const payload = {
            "content": `⚠️ ${mentionToken} **YOUR BASE IS UNDER ATTACK!**`,
            "username": "Scout Bot",
            "avatar_url": "https://images.tribesofmalaya.com/items/food-v5-x32.png", 
            "embeds": [{
                "title": "⚔️ INCOMING ATTACK DETECTED ⚔️",
                "description": `An aggressive march led by **${attacker}** has targeted your domain!`,
                "color": 15158332, 
                "fields": [
                    { "name": "👑 Ruler Account", "value": `\`${targetName}\``, "inline": true },
                    { "name": "⏱️ ETA (System Time)", "value": `\`${formattedETA}\``, "inline": false },
                    { "name": "⏳ Landing In", "value": `<t:${landEpochSeconds}:R>`, "inline": false }
                ],
                "timestamp": new Date().toISOString()
            }]
        };
        sendDiscordPayload(payload);

        const trackingKey = `${targetName}_${attacker}_${landEpochMs}`;
        if (!activeLandWatchers.has(trackingKey)) {
            activeLandWatchers.add(trackingKey);
            
            const delayExecutionMs = landEpochMs - Date.now();
            if (delayExecutionMs > 0) {
                setTimeout(() => {
                    dispatchLandedAlert(targetDiscordId, targetName, attacker);
                    activeLandWatchers.delete(trackingKey);
                    // FIXED: Let the execution loop handle registry deletion only after impact
                    activeMarchRegistry.delete(landEpochMs); 
                }, delayExecutionMs);
            } else {
                activeLandWatchers.delete(trackingKey);
                activeMarchRegistry.delete(landEpochMs);
            }
        }
    }

    function dispatchLandedAlert(discordId, name, attacker) {
        const mentionToken = `<@${discordId}>`;
        
        const payload = {
            "content": `💥 ${mentionToken} **THE ENEMY HAS LANDED!**`,
            "username": "Scout Bot",
            "embeds": [{
                "title": "🔴 STRIKE CONFIRMED 🔴",
                "description": `The hostile march from **${attacker}** has officially hit **${name}**!`,
                "color": 0, 
                "timestamp": new Date().toISOString()
            }]
        };
        sendDiscordPayload(payload);
    }

    function processSystemScan() {
        const townId = getTownId();
        const playerInfo = getProfileIdentity(); 
        const activeAttacks = scanForAttacks(); 

        const nowMs = Date.now();

        // Push live status to storage so the popup UI can display it (added, read-only side effect)
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                attackStatus: {
                    townId,
                    name: playerInfo ? playerInfo.name : null,
                    incomingCount: activeAttacks.length,
                    updatedAt: nowMs
                }
            });
        }

        // UI gate: if the user has disabled Attack Alerts from the popup, skip dispatching (added, does not alter detection/tracking logic)
        if (!attackAlertsEnabled) {
            return;
        }
        
        for (let attack of activeAttacks) {
            const { attacker, totalSeconds } = attack;
            
            // Safety break: Skip immediately if it has already landed
            if (totalSeconds <= 0) continue;

            const trackingDisplayName = playerInfo ? playerInfo.name : `Unregistered Town (#${townId})`;
            const baseSignature = `${trackingDisplayName}_${attacker}`;
            const calculatedLandEpochMs = nowMs + (totalSeconds * 1000);

            let isAlreadyRegistered = false;
            
            // FIXED: Scan registry for active landings using a looser millisecond target threshold (+/- 4 seconds)
            // This safely matches the march regardless of lag variants when you open/close the container menu
            for (let [registeredTimestamp, registeredSignature] of activeMarchRegistry.entries()) {
                if (registeredSignature === baseSignature && Math.abs(registeredTimestamp - calculatedLandEpochMs) < 4000) {
                    isAlreadyRegistered = true;
                    break;
                }
            }

            if (!isAlreadyRegistered) {
                // Keep recorded timestamp pinned to the calculated target window index
                activeMarchRegistry.set(calculatedLandEpochMs, baseSignature);
                dispatchAttackAlert(playerInfo, attacker, totalSeconds, calculatedLandEpochMs);
            }
        }

        // FIXED: Wiped out the aggressive 5-second automatic cleaner loop entirely.
        // Instead, we safely clean up dead values if the target window has passed the current time.
        for (let registeredTimestamp of activeMarchRegistry.keys()) {
            if (nowMs > registeredTimestamp + 10000) { // Keep alive until 10s post-landing
                activeMarchRegistry.delete(registeredTimestamp);
            }
        }
    }

    // Safely isolated instance name for the attack observer
    const attackObserver = new MutationObserver(() => {
        processSystemScan();
    });

    attackObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    console.log("Defensive Core Framework V7.8 - Duplicate Prevention Engine Online.");
})();