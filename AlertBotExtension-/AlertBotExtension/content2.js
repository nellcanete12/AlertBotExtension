(() => {
    // ==================== CONFIGURATION ====================
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1521490109416083467/QEto3Z0vOATagffhK-RQGpR-hfNGwYHoaBqBTvCZ3Gr0dDDlfGoWRyr5Nt0ZtSENCIgR";

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
        "36355": { name: "Origin", discordId: "1326191764419252265" },
        "17165": { name: "PopTarts", discordId: "1516845159956877402" }

    };
    // =======================================================

    const activeMarchRegistry = new Map();
    // Replaced Set with a Map to store actual timeout IDs for clean management
    const activeLandWatchers = new Map(); 

    // IMPROVED: Extracts numeric Town ID from pathname OR search queries to prevent "UNKNOWN" bugs
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

        // CREATE LANDING WATCHER
        const trackingKey = `${targetName}_${attacker}`;
        
        // Prevent duplicate landing timer handles if one already exists for this match configuration
        if (!activeLandWatchers.has(trackingKey)) {
            const delayExecutionMs = landEpochMs - Date.now();
            if (delayExecutionMs > 0) {
                const timeoutId = setTimeout(() => {
                    dispatchLandedAlert(targetDiscordId, targetName, attacker);
                    activeLandWatchers.delete(trackingKey);
                }, delayExecutionMs);
                
                activeLandWatchers.set(trackingKey, timeoutId);
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
        
        for (let attack of activeAttacks) {
            const { attacker, totalSeconds } = attack;
            
            if (totalSeconds <= 0) continue;

            const trackingDisplayName = playerInfo ? playerInfo.name : `Unregistered Town (#${townId})`;
            const baseSignature = `${trackingDisplayName}_${attacker}`;
            const calculatedLandEpochMs = nowMs + (totalSeconds * 1000);

            let isAlreadyRegistered = false;
            
            // Check against existing logs using an expanded 6-second delta 
            // to absorb severe DOM mutation updates right at impact.
            for (let [registeredTimestamp, registeredSignature] of activeMarchRegistry.entries()) {
                if (registeredSignature === baseSignature && Math.abs(registeredTimestamp - calculatedLandEpochMs) < 6000) {
                    isAlreadyRegistered = true;
                    break;
                }
            }

            if (!isAlreadyRegistered) {
                activeMarchRegistry.set(calculatedLandEpochMs, baseSignature);
                dispatchAttackAlert(playerInfo, attacker, totalSeconds, calculatedLandEpochMs);
            }
        }

        // Clean up old tracked items only if they are older than 25 seconds past landing.
        // This ensures the strict cooldown lock remains active through the landing chaos.
        for (let registeredTimestamp of activeMarchRegistry.keys()) {
            if (nowMs > registeredTimestamp + 25000) { 
                activeMarchRegistry.delete(registeredTimestamp);
            }
        }
    }

    const attackObserver = new MutationObserver(() => {
        processSystemScan();
    });

    attackObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    console.log("Defensive Core Framework V8.0 - Absolute Duplicate Lock Active.");
})();