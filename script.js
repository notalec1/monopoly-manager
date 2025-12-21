// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, remove, update } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- 3. EXPORTS ---
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

// --- 4. LISTENERS ---
let allPlayersData = {}; 

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    const playersGrid = document.getElementById("playersGrid");
    playersGrid.innerHTML = "";
    const data = snapshot.val();
    allPlayersData = data || {}; 

    // Update Pot Winner Dropdown
    updatePotDropdown();

    if (data) {
        Object.keys(data).forEach(key => {
            renderPlayerCard(key, data[key]);
        });
    }
});

const potRef = ref(db, 'pot');
onValue(potRef, (snapshot) => {
    const val = snapshot.val() || 0;
    document.getElementById("potAmount").textContent = `$${val}`;
});

const logsRef = ref(db, 'logs');
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

const diceRef = ref(db, 'dice');
onValue(diceRef, (snapshot) => {
    const val = snapshot.val();
    if(val) document.getElementById("diceResult").textContent = val;
});

// --- 5. FUNCTIONS ---

function addPlayer() {
    const input = document.getElementById("newPlayerName");
    const name = input.value.trim();
    if (!name) return;

    const avatarSeed = Math.floor(Math.random() * 5000);

    push(playersRef, {
        name: name,
        money: 1500,
        avatar: avatarSeed,
        isJailed: false,
        properties: {}
    });
    
    log(`<b>${name}</b> joined.`);
    input.value = "";
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
    
    // Color Logic
    let colorClass = "#10b981"; 
    if (player.money < 1000) colorClass = "#f59e0b"; 
    if (player.money < 500) colorClass = "#ef4444"; 

    // Jail Logic
    const jailClass = player.isJailed ? "jailed" : "";
    const jailText = player.isJailed ? "GET OUT OF JAIL" : "GO TO JAIL";
    const passGoDisabled = player.isJailed ? "disabled" : "";

    // Build Properties
    let propsHtml = "";
    if (player.properties) {
        Object.entries(player.properties).forEach(([propId, propObj]) => {
            // Handle old data structure (string) vs new (object)
            const pName = propObj.name || propObj; 
            const pColor = propObj.color || "railroad";
            const pMortgaged = propObj.mortgaged ? "mortgaged" : "";
            const mortIcon = propObj.mortgaged ? "fa-toggle-on" : "fa-toggle-off";

            propsHtml += `
            <div class="prop-tag prop-${pColor} ${pMortgaged}">
                <span>${pName}</span>
                <div class="prop-actions">
                    <button class="btn-small" onclick="toggleMortgage('${id}', '${propId}')" title="Mortgage">
                        <i class="fa-solid ${mortIcon}"></i>
                    </button>
                    <button class="btn-small" onclick="deleteProperty('${id}', '${propId}', '${player.name}', '${pName}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
        });
    } else {
        propsHtml = `<div style="color:#64748b; font-size:0.8rem; text-align:center; padding:10px;">No properties</div>`;
    }

    // Transfer Dropdown Options
    let transferOptions = `<option value="">Select Player...</option>`;
    Object.keys(allPlayersData).forEach(otherId => {
        if(otherId !== id) { 
            transferOptions += `<option value="${otherId}">${allPlayersData[otherId].name}</option>`;
        }
    });

    const seed = player.avatar || player.name;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;

    const card = document.createElement("div");
    card.className = `card ${jailClass}`;
    card.innerHTML = `
        <div class="card-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${avatarUrl}" class="player-avatar" alt="avatar">
                <div>
                    <h3>${player.name}</h3>
                    <span class="jailed-badge">IN JAIL</span>
                </div>
            </div>
            <div class="money-badge" style="color:${colorClass}">$${player.money}</div>
        </div>
        
        <button class="btn-go" onclick="passGo('${id}', '${player.name}')" ${passGoDisabled}>
            <i class="fa-solid fa-arrow-right-to-bracket"></i> PASS GO (+$200)
        </button>

        <div class="control-row" style="margin-top:10px">
            <input type="number" id="amount-${id}" placeholder="$$$">
            <button class="btn-add" onclick="updateMoney('${id}', '${player.name}', 1)">+</button>
            <button class="btn-pay" onclick="updateMoney('${id}', '${player.name}', -1)">-</button>
        </div>

        <div class="control-row" style="margin-top:5px;">
            <select id="transfer-${id}" style="width:100%; border-radius:8px; padding:8px; border:none;">
                ${transferOptions}
            </select>
            <button class="btn-pay" style="width:auto; padding:0 10px;" onclick="transferMoney('${id}', '${player.name}')">Pay</button>
        </div>

        <div style="border-top:1px solid #334155; margin: 15px 0;"></div>

        <div class="control-row">
            <input type="text" id="prop-name-${id}" placeholder="Boardwalk...">
            <select id="prop-color-${id}" style="width:100px;">
                <option value="brown">Brown</option>
                <option value="lightblue">Lt. Blue</option>
                <option value="pink">Pink</option>
                <option value="orange">Orange</option>
                <option value="red">Red</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="blue">Dk. Blue</option>
                <option value="railroad">Rail</option>
                <option value="utility">Util</option>
            </select>
        </div>
        <button class="btn-buy" style="width:100%; margin-top:5px;" onclick="addProperty('${id}', '${player.name}')">Add Property</button>

        <div class="props-container" style="margin-top:10px;">
            ${propsHtml}
        </div>

        <button class="jail-btn" onclick="toggleJail('${id}')">${jailText}</button>
    `;
    grid.appendChild(card);
}

// --- LOGIC FUNCTIONS ---

// 1. FREE PARKING POT
function addToPot(amount) {
    onValue(potRef, (snap) => {
        const current = snap.val() || 0;
        set(potRef, current + amount);
        log(`Added <span style="color:#f59e0b">$${amount}</span> to Free Parking.`);
    }, { onlyOnce: true });
}

function claimPot() {
    const winnerId = document.getElementById("potWinner").value;
    if(!winnerId) return alert("Select a winner!");

    onValue(potRef, (snap) => {
        const potValue = snap.val() || 0;
        if(potValue === 0) return;

        // Give to player
        performTransaction(winnerId, potValue);
        
        // Reset Pot
        set(potRef, 0);

        const name = allPlayersData[winnerId].name;
        log(`<b>${name}</b> won the <span style="color:#f59e0b">$${potValue}</span> jackpot!`);
    }, { onlyOnce: true });
}

// 2. JAIL LOGIC
function toggleJail(id) {
    const refJail = ref(db, `players/${id}/isJailed`);
    onValue(refJail, (snap) => {
        const status = !snap.val();
        set(refJail, status);
        const name = allPlayersData[id].name;
        if(status) log(`${name} went to JAIL!`);
        else log(`${name} was released from Jail.`);
    }, { onlyOnce: true });
}

// 3. PROPERTY LOGIC (NEW: Objects instead of Strings)
function addProperty(id, name) {
    const nameInput = document.getElementById(`prop-name-${id}`);
    const colorInput = document.getElementById(`prop-color-${id}`);
    
    const propName = nameInput.value.trim();
    const propColor = colorInput.value;

    if (!propName) return;

    // Save as Object
    push(ref(db, `players/${id}/properties`), {
        name: propName,
        color: propColor,
        mortgaged: false
    });
    
    log(`${name} bought <b>${propName}</b>`);
    nameInput.value = "";
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
    log(`${name} passed GO and collected <span style="color:#10b981">$200</span>`);
}

function performTransaction(id, amount) {
    const pRef = ref(db, `players/${id}/money`);
    onValue(pRef, (snap) => {
        const current = snap.val();
        set(pRef, current + amount);
    }, { onlyOnce: true });
}

function transferMoney(senderId, senderName) {
    const amountInput = document.getElementById(`amount-${senderId}`);
    const targetSelect = document.getElementById(`transfer-${senderId}`);
    
    const amount = parseInt(amountInput.value);
    const targetId = targetSelect.value;
    
    if (!amount || !targetId) {
        alert("Please enter an amount and select a player.");
        return;
    }

    performTransaction(senderId, -amount);
    performTransaction(targetId, amount);

    const targetName = allPlayersData[targetId].name;
    log(`${senderName} paid <span style="color:#ef4444">$${amount}</span> to ${targetName}`);
    amountInput.value = "";
}

function deleteProperty(playerId, propId, playerName, propName) {
    remove(ref(db, `players/${playerId}/properties/${propId}`));
    log(`${playerName} sold/lost <b>${propName}</b>`);
}

function rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    let msg = `${d1} + ${d2} = ${total}`;
    if (d1 === d2) msg += " (DOUBLES!)";
    
    set(diceRef, msg);
    log(`Dice Rolled: ${msg}`);
}

function log(msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    push(logsRef, `<span style="color:#64748b; font-size:0.8em">[${time}]</span> ${msg}`);
}

function resetGame() {
    if(confirm("⚠ WARNING: This will delete ALL players and history. Continue?")) {
        set(playersRef, {});
        set(logsRef, {});
        set(ref(db, 'pot'), 0);
        set(diceRef, "--");
    }
}

// --- ADMIN VS SPECTATOR LOGIC ---
function checkMode() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // If "?admin=true" is NOT in the URL, hide controls
    if (!urlParams.has('admin')) {
        document.body.classList.add('spectator');
        
        // Optional: Change Sidebar Title for TV
        const brand = document.querySelector('.brand');
        if(brand) brand.innerHTML = '<i class="fa-solid fa-tv"></i> Live Scoreboard';
    }
}

// Run immediately
checkMode();
