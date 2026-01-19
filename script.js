// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, ref, push, onValue, set, remove, update, off, get 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
    signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signOut, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 2. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBzH2VEhPHMYNVIWxtnrspGsg-Am8yN1fI",
    authDomain: "monoplymanager.firebaseapp.com",
    projectId: "monoplymanager",
    storageBucket: "monoplymanager.firebasestorage.app",
    messagingSenderId: "523334526288",
    appId: "1:523334526288:web:9c3a039c984edfa6477855",
    measurementId: "G-716Y6EQR1C"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- 3. STATE VARIABLES ---
let allPlayersData = {}; 
let gameStartTime = null;
let currentUser = null;
let hostUid = null;
let isRegistering = false;

// Database References
const playersRef = ref(db, 'players');
const potRef = ref(db, 'pot');
const logsRef = ref(db, 'logs');
const diceRef = ref(db, 'dice');
const timerRef = ref(db, 'gameState/startTime');
const hostRef = ref(db, 'gameState/host');

// --- 4. EXPORTS ---
// Game
window.addPlayer = addPlayer;
window.rollDice = rollDice;
window.resetGame = resetGame;
window.updateMoney = updateMoney;
window.passGo = passGo;
window.addProperty = addProperty;
window.deleteProperty = deleteProperty;
window.transferMoney = transferMoney;
window.addToPot = addToPot;
window.claimPot = claimPot;
window.toggleJail = toggleJail;
window.toggleMortgage = toggleMortgage;
window.updateHouses = updateHouses;
window.bankruptPlayer = bankruptPlayer;

// Auth
window.handleEmailAuth = handleEmailAuth;
window.signInGoogle = signInGoogle;
window.signInAnon = signInAnon;
window.logout = logout;
window.toggleAuthMode = toggleAuthMode;
window.handlePasswordReset = handlePasswordReset;

// --- 5. AUTHENTICATION LOGIC ---

// Listen for Auth State Changes
onAuthStateChanged(auth, (user) => {
    const overlay = document.getElementById("authOverlay");
    
    if (user) {
        // User is signed in
        currentUser = user;
        overlay.classList.add("hidden");
        console.log("Logged in as:", user.uid);
        initGameListeners(); // Start the game data sync
        checkMode();
    } else {
        // User is signed out
        currentUser = null;
        overlay.classList.remove("hidden");
        detachGameListeners(); // Stop data sync
    }
});

async function signInGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        showAuthError(error.message);
    }
}

async function signInAnon() {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        showAuthError(error.message);
    }
}

async function handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;

    try {
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, pass);
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch (error) {
        let msg = error.code.replace("auth/", "").replace(/-/g, " ");
        showAuthError(msg);
    }
}

function toggleAuthMode() {
    isRegistering = !isRegistering;
    const btn = document.getElementById("authBtnLabel");
    const toggleText = document.getElementById("toggleAuthText");
    
    if(isRegistering) {
        btn.textContent = "Create Account";
        toggleText.textContent = "Have an account? Sign In";
    } else {
        btn.textContent = "Sign In";
        toggleText.textContent = "Need an account? Register";
    }
}

async function handlePasswordReset() {
    const email = document.getElementById("emailInput").value;
    if(!email) return showAuthError("Please enter your email first.");
    
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent!");
    } catch (error) {
        showAuthError(error.message);
    }
}

function logout() {
    signOut(auth);
    // Reload to clear local state visually immediately
    window.location.reload(); 
}

function showAuthError(msg) {
    const el = document.getElementById("authError");
    el.textContent = msg;
    el.style.display = "block";
}


// --- 6. LISTENERS (Managed) ---

function initGameListeners() {
    
    // Host/Banker Logic
    onValue(hostRef, (snap) => {
        hostUid = snap.val();
        
        // If no host exists, claim it!
        if (!hostUid && currentUser) {
            set(hostRef, currentUser.uid);
        }

        const bankerDisplay = document.getElementById("bankerNameDisplay");
        
        // Check if I am the host
        if (currentUser && hostUid === currentUser.uid) {
            document.body.classList.add('is-banker'); // Shows Nuke Button via CSS
            if(bankerDisplay) bankerDisplay.textContent = "YOU 👑";
        } else {
            document.body.classList.remove('is-banker'); // Hides Nuke Button via CSS
            if(bankerDisplay) bankerDisplay.textContent = "Someone Else"; 
        }
    });

    // Players Listener
    onValue(playersRef, (snapshot) => {
        const playersGrid = document.getElementById("playersGrid");
        playersGrid.innerHTML = "";
        const data = snapshot.val();
        allPlayersData = data || {}; 

        updatePotDropdown();

        if (data) {
            // Sort by Net Worth (Wealth Leaderboard logic)
            const sorted = Object.entries(data).sort((a, b) => {
                const nwA = calculateNetWorth(a[1]);
                const nwB = calculateNetWorth(b[1]);
                return nwB - nwA; // Descending
            });

            sorted.forEach(([key, player]) => {
                renderPlayerCard(key, player);
            });
        }
    });

    // Pot Listener
    onValue(potRef, (snapshot) => {
        const val = snapshot.val() || 0;
        document.getElementById("potAmount").textContent = `$${val}`;
    });

    // Logs Listener
    onValue(logsRef, (snapshot) => {
        const list = document.getElementById("logList");
        list.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            const logs = Object.values(data).reverse(); 
            logs.forEach(msg => {
                const li = document.createElement("li");
                li.innerHTML = msg; 
                list.appendChild(li);
            });
        }
    });

    // Dice Listener
    onValue(diceRef, (snapshot) => {
        if(snapshot.val()) document.getElementById("diceResult").innerHTML = snapshot.val();
    });

    // Timer Listener
    onValue(timerRef, (snap) => {
        gameStartTime = snap.val();
        if(!gameStartTime) {
            // Initialize timer if not exists
            set(timerRef, Date.now());
        }
    });
}

function detachGameListeners() {
    off(playersRef);
    off(potRef);
    off(logsRef);
    off(diceRef);
    off(timerRef);
    off(hostRef);
}

// Timer Interval
setInterval(() => {
    const display = document.getElementById("gameTimer");
    if(!gameStartTime) {
        display.textContent = "00:00:00";
        return;
    }
    const diff = Date.now() - gameStartTime;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    display.textContent = 
        `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}, 1000);

// --- 7. FUNCTIONS ---

function addPlayer() {
    if(!currentUser) return; // Auth Check
    const input = document.getElementById("newPlayerName");
    const name = input.value.trim();
    if (!name) return;

    push(playersRef, {
        name: name,
        money: 1500,
        avatar: Math.floor(Math.random() * 5000),
        isJailed: false,
        properties: {}
    });
    
    log(`<b>${name}</b> joined the game.`);
    input.value = "";
}

function calculateNetWorth(player) {
    let nw = player.money || 0;
    if(player.properties) {
        Object.values(player.properties).forEach(p => {
            if(!p.mortgaged) {
                nw += (parseInt(p.cost) || 0); // Property Value
                // Assume house value is rough estimate or added field. 
                // For now, simplifiction: Houses = $100 value per house (avg)
                const houses = p.houses || 0;
                const isHotel = p.isHotel || false;
                if(isHotel) nw += 500;
                else nw += (houses * 100);
            } else {
                nw += (parseInt(p.cost) || 0) / 2; // Mortgaged value
            }
        });
    }
    return nw;
}

function updatePotDropdown() {
    const select = document.getElementById("potWinner");
    select.innerHTML = `<option value="">Select Winner...</option>`;
    Object.keys(allPlayersData).forEach(id => {
        select.innerHTML += `<option value="${id}">${allPlayersData[id].name}</option>`;
    });
}

function renderPlayerCard(id, player) {
    const grid = document.getElementById("playersGrid");
    
    // Status Logic
    let colorClass = "#10b981"; 
    if (player.money < 500) colorClass = "#ef4444"; 

    const jailClass = player.isJailed ? "jailed" : "";
    const netWorth = calculateNetWorth(player);

    // Build Properties HTML with Houses
    let propsHtml = "";
    if (player.properties) {
        Object.entries(player.properties).forEach(([propId, propObj]) => {
            const pName = propObj.name;
            const pColor = propObj.color || "railroad";
            const pMortgaged = propObj.mortgaged ? "mortgaged" : "";
            const houses = propObj.houses || 0;
            const isHotel = propObj.isHotel || false;

            // Visual House Pips
            let housePips = "";
            if(isHotel) housePips = `<div class="hotel-pip"></div>`;
            else {
                for(let i=0; i<houses; i++) housePips += `<div class="house-pip"></div>`;
            }

            propsHtml += `
            <div class="prop-tag prop-${pColor} ${pMortgaged}">
                <div class="prop-header">
                    <span>${pName}</span>
                    <div class="house-indicator">${housePips}</div>
                </div>
                <div class="prop-details">
                    <div class="prop-actions">
                         <button class="btn-tiny" onclick="updateHouses('${id}', '${propId}', 1)">+🏠</button>
                         <button class="btn-tiny" onclick="updateHouses('${id}', '${propId}', -1)">-🏠</button>
                    </div>
                    <div class="prop-actions">
                        <button class="btn-tiny" onclick="toggleMortgage('${id}', '${propId}')">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                        <button class="btn-tiny" style="color:#ef4444" onclick="deleteProperty('${id}', '${propId}', '${player.name}', '${pName}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        });
    } else {
        propsHtml = `<div style="color:#64748b; font-size:0.8rem; text-align:center; padding:10px;">No properties</div>`;
    }

    let transferOptions = `<option value="">Select Player...</option>`;
    Object.keys(allPlayersData).forEach(otherId => {
        if(otherId !== id) transferOptions += `<option value="${otherId}">${allPlayersData[otherId].name}</option>`;
    });

    const card = document.createElement("div");
    card.className = `card ${jailClass}`;
    card.innerHTML = `
        <div class="card-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${player.avatar}" class="player-avatar">
                <div>
                    <h3 style="margin:0">${player.name}</h3>
                    <span class="jailed-badge">IN JAIL</span>
                </div>
            </div>
            <div class="money-container">
                <div class="money-badge" style="color:${colorClass}">$${player.money}</div>
            </div>
        </div>
        
        <div class="stats-row">
            <span>Net Worth: <span class="stat-val">$${netWorth}</span></span>
            <span>Props: <span class="stat-val">${Object.keys(player.properties || {}).length}</span></span>
        </div>

        <button class="btn-go" onclick="passGo('${id}', '${player.name}')" ${player.isJailed ? 'disabled' : ''}>
            <i class="fa-solid fa-arrow-right-to-bracket"></i> PASS GO (+$200)
        </button>

        <div class="control-row" style="margin-top:10px">
            <input type="number" id="amount-${id}" placeholder="$$$">
            <button class="btn-add" onclick="updateMoney('${id}', '${player.name}', 1)">+</button>
            <button class="btn-pay" onclick="updateMoney('${id}', '${player.name}', -1)">-</button>
        </div>

        <div class="control-row" style="margin-top:5px;">
            <select id="transfer-${id}" style="border-radius:8px; padding:8px; border:none; width:70%">
                ${transferOptions}
            </select>
            <button class="btn-pay" style="width:30%; padding:0 5px;" onclick="transferMoney('${id}', '${player.name}')">Pay</button>
        </div>

        <div style="border-top:1px solid #334155; margin: 10px 0;"></div>

        <div class="control-row">
            <input type="text" id="prop-name-${id}" placeholder="Name..." style="width:50%">
            <input type="number" id="prop-cost-${id}" placeholder="$ Cost" style="width:25%">
            <select id="prop-color-${id}" style="width:25%;">
                <option value="brown">🟫</option>
                <option value="lightblue">💠</option>
                <option value="pink">🎀</option>
                <option value="orange">🟧</option>
                <option value="red">🟥</option>
                <option value="yellow">🟨</option>
                <option value="green">🟩</option>
                <option value="blue">🟦</option>
                <option value="railroad">🚂</option>
                <option value="utility">💡</option>
            </select>
        </div>
        <button class="btn-buy" style="width:100%; margin-top:5px;" onclick="addProperty('${id}', '${player.name}')">Add Property</button>

        <div class="props-container" style="margin-top:10px;">
            ${propsHtml}
        </div>

        <div style="display:flex; gap:5px; margin-top:5px">
             <button class="jail-btn" onclick="toggleJail('${id}')">${player.isJailed ? "RELEASE" : "JAIL"}</button>
             <button class="jail-btn" style="color:var(--danger)" onclick="bankruptPlayer('${id}', '${player.name}')">☠</button>
        </div>
    `;
    grid.appendChild(card);
}

// --- LOGIC FUNCTIONS ---

function updateHouses(playerId, propId, change) {
    if(!currentUser) return;
    const propRef = ref(db, `players/${playerId}/properties/${propId}`);
    onValue(propRef, (snap) => {
        const prop = snap.val();
        if(!prop) return;

        let houses = prop.houses || 0;
        let isHotel = prop.isHotel || false;

        if (change > 0) {
            // Add House
            if (!isHotel) {
                if (houses < 4) houses++;
                else { houses = 0; isHotel = true; }
            }
        } else {
            // Remove House
            if (isHotel) { isHotel = false; houses = 4; }
            else if (houses > 0) houses--;
        }

        update(propRef, { houses: houses, isHotel: isHotel });
    }, { onlyOnce: true });
}

function addToPot(amount) {
    onValue(potRef, (snap) => {
        set(potRef, (snap.val() || 0) + amount);
        log(`Added <span style="color:#f59e0b">$${amount}</span> to Pot.`);
    }, { onlyOnce: true });
}

function claimPot() {
    const winnerId = document.getElementById("potWinner").value;
    if(!winnerId) return alert("Select a winner!");

    onValue(potRef, (snap) => {
        const potValue = snap.val() || 0;
        if(potValue === 0) return;
        
        performTransaction(winnerId, potValue);
        set(potRef, 0);
        
        // Trigger Confetti
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

        const name = allPlayersData[winnerId].name;
        log(`🎰 <b>${name}</b> WON THE <span style="color:#f59e0b">$${potValue}</span> JACKPOT!`);
    }, { onlyOnce: true });
}

function toggleJail(id) {
    const refJail = ref(db, `players/${id}/isJailed`);
    onValue(refJail, (snap) => {
        const status = !snap.val();
        set(refJail, status);
        const name = allPlayersData[id].name;
        if(status) {
            log(`🚔 ${name} went to JAIL!`);
        } else {
            log(`🕊 ${name} released from Jail.`);
        }
    }, { onlyOnce: true });
}

function bankruptPlayer(id, name) {
    if(confirm(`Are you sure you want to bankrupt ${name}? This cannot be undone.`)) {
        remove(ref(db, `players/${id}`));
        log(`☠ <b>${name}</b> WENT BANKRUPT!`);
    }
}

function addProperty(id, name) {
    const nameInput = document.getElementById(`prop-name-${id}`);
    const costInput = document.getElementById(`prop-cost-${id}`);
    const colorInput = document.getElementById(`prop-color-${id}`);
    
    if (!nameInput.value || !costInput.value) return alert("Name and Cost required");

    push(ref(db, `players/${id}/properties`), {
        name: nameInput.value.trim(),
        cost: parseInt(costInput.value),
        color: colorInput.value,
        mortgaged: false,
        houses: 0,
        isHotel: false
    });
    
    log(`${name} bought <b>${nameInput.value}</b> for $${costInput.value}`);
    nameInput.value = "";
    costInput.value = "";
}

function toggleMortgage(playerId, propId) {
    const mRef = ref(db, `players/${playerId}/properties/${propId}/mortgaged`);
    onValue(mRef, (snap) => {
        set(mRef, !snap.val());
    }, { onlyOnce: true });
}

function updateMoney(id, name, multiplier) {
    const input = document.getElementById(`amount-${id}`);
    const amount = parseInt(input.value);
    if (!amount) return;

    performTransaction(id, amount * multiplier);

    const action = multiplier > 0 ? "received" : "paid";
    const color = multiplier > 0 ? "#10b981" : "#ef4444";
    log(`${name} ${action} <span style="color:${color}">$${amount}</span>`);
    input.value = "";
}

function passGo(id, name) {
    performTransaction(id, 200);
    confetti({ particleCount: 50, spread: 60, origin: { x: 0.5, y:0.8 } }); // Small burst
    log(`💸 ${name} passed GO (+$200)`);
}

function performTransaction(id, amount) {
    const pRef = ref(db, `players/${id}/money`);
    onValue(pRef, (snap) => {
        set(pRef, snap.val() + amount);
    }, { onlyOnce: true });
}

function transferMoney(senderId, senderName) {
    const amountInput = document.getElementById(`amount-${senderId}`);
    const targetSelect = document.getElementById(`transfer-${senderId}`);
    const amount = parseInt(amountInput.value);
    const targetId = targetSelect.value;
    
    if (!amount || !targetId) return alert("Enter amount and select player.");

    performTransaction(senderId, -amount);
    performTransaction(targetId, amount);

    const targetName = allPlayersData[targetId].name;
    log(`${senderName} paid <span style="color:#ef4444">$${amount}</span> to ${targetName}`);
    amountInput.value = "";
}

function deleteProperty(playerId, propId, playerName, propName) {
    if(confirm(`Remove ${propName} from ${playerName}?`)) {
        remove(ref(db, `players/${playerId}/properties/${propId}`));
        log(`${playerName} lost/sold <b>${propName}</b>`);
    }
}

function rollDice() {
    // 3D Dice physics would require Three.js (too heavy). 
    // We stick to standard RNG but add emoji visuals.
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    
    const diceIcons = ["⚀","⚁","⚂","⚃","⚄","⚅"];
    const resultHtml = `<span style="font-size:2rem">${diceIcons[d1-1]} ${diceIcons[d2-1]}</span> <br> <span style="font-size:1rem">${d1+d2}</span>`;
    
    set(diceRef, resultHtml);
    
    let msg = `${d1} + ${d2} = <b>${d1+d2}</b>`;
    if (d1 === d2) msg += " (DOUBLES!)";
    log(`🎲 Rolled: ${msg}`);
}

function log(msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    push(logsRef, `<span style="color:#64748b; font-size:0.8em">[${time}]</span> ${msg}`);
}

function resetGame() {
    // BANKER CHECK
    if (hostUid && hostUid !== currentUser.uid) {
        return alert("⛔ Only the Banker (Host) can nuke the game!");
    }

    if(confirm("⚠ WARNING: NUKE THE GAME? This deletes EVERYTHING.")) {
        // Prepare updates to nuke DB but preserve HOST
        const updates = {};
        updates['players'] = null;
        updates['logs'] = null;
        updates['pot'] = 0;
        updates['dice'] = "--";
        updates['gameState/startTime'] = Date.now();
        // Ensure I stay the host
        updates['gameState/host'] = currentUser.uid;

        update(ref(db), updates);
        log(`☢ <b>GAME NUKED</b> by the Banker!`);
    }
}

function checkMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('admin') && !currentUser) {
        document.body.classList.add('spectator');
        const brand = document.querySelector('.brand');
        if(brand) brand.innerHTML = '<i class="fa-solid fa-tv"></i> Live Scoreboard';
    } else {
        document.body.classList.remove('spectator');
    }
}
