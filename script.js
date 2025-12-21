// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, remove } 
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

// --- 4. LISTENERS ---
let allPlayersData = {}; 

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    const playersGrid = document.getElementById("playersGrid");
    playersGrid.innerHTML = "";
    const data = snapshot.val();
    allPlayersData = data || {}; 

    if (data) {
        Object.keys(data).forEach(key => {
            renderPlayerCard(key, data[key]);
        });
    }
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

    // Generate a random avatar seed
    const avatarSeed = Math.floor(Math.random() * 5000);

    push(playersRef, {
        name: name,
        money: 1500,
        avatar: avatarSeed,
        properties: {}
    });
    
    log(`<b>${name}</b> joined the game.`);
    input.value = "";
}

function renderPlayerCard(id, player) {
    const grid = document.getElementById("playersGrid");
    
    // Color Logic
    let colorClass = "#10b981"; 
    if (player.money < 1000) colorClass = "#f59e0b"; 
    if (player.money < 500) colorClass = "#ef4444"; 

    // Properties Logic
    let propsHtml = "";
    if (player.properties) {
        Object.entries(player.properties).forEach(([propId, propName]) => {
            propsHtml += `
            <div class="prop-tag">
                <span><i class="fa-solid fa-house-chimney"></i> ${propName}</span>
                <button class="btn-del-prop" onclick="deleteProperty('${id}', '${propId}', '${player.name}', '${propName}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
        });
    } else {
        propsHtml = `<div style="color:#64748b; font-size:0.8rem; text-align:center; padding:10px;">No properties yet</div>`;
    }

    // Transfer Options
    let transferOptions = `<option value="">Select Player...</option>`;
    Object.keys(allPlayersData).forEach(otherId => {
        if(otherId !== id) { 
            transferOptions += `<option value="${otherId}">${allPlayersData[otherId].name}</option>`;
        }
    });

    // Avatar URL
    const seed = player.avatar || player.name;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="card-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${avatarUrl}" class="player-avatar" alt="avatar">
                <h3>${player.name}</h3>
            </div>
            <div class="money-badge" style="color:${colorClass}">$${player.money}</div>
        </div>
        
        <!-- Pass Go Button -->
        <button class="btn-go" onclick="passGo('${id}', '${player.name}')">
            <i class="fa-solid fa-arrow-right-to-bracket"></i> PASS GO (Collect $200)
        </button>
        <div style="margin-bottom: 15px;"></div>

        <div class="control-row">
            <input type="number" id="amount-${id}" placeholder="Amount...">
            <button class="btn-add" onclick="updateMoney('${id}', '${player.name}', 1)">+</button>
            <button class="btn-pay" onclick="updateMoney('${id}', '${player.name}', -1)">-</button>
        </div>

        <div class="control-row" style="margin-top:5px;">
            <select id="transfer-${id}" style="width:100%; padding:8px; border-radius:8px; background:#334155; color:white; border:none;">
                ${transferOptions}
            </select>
            <button class="btn-pay" style="width:auto; padding:0 10px;" onclick="transferMoney('${id}', '${player.name}')">Pay</button>
        </div>

        <div style="border-top:1px solid #334155; margin: 15px 0;"></div>

        <div class="control-row">
            <input type="text" id="prop-${id}" placeholder="Property Name...">
            <button class="btn-buy" onclick="addProperty('${id}', '${player.name}')">Buy</button>
        </div>

        <div class="props-container">
            ${propsHtml}
        </div>
    `;
    grid.appendChild(card);
}

// --- LOGIC FUNCTIONS ---

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

    // 1. Deduct
    performTransaction(senderId, -amount);
    // 2. Add
    performTransaction(targetId, amount);

    // Get Target Name (Visual only)
    const targetName = allPlayersData[targetId].name;
    log(`${senderName} paid <span style="color:#ef4444">$${amount}</span> to ${targetName}`);
    
    amountInput.value = "";
}

function addProperty(id, name) {
    const input = document.getElementById(`prop-${id}`);
    const propName = input.value.trim();
    if (!propName) return;

    push(ref(db, `players/${id}/properties`), propName);
    log(`${name} bought <b>${propName}</b>`);
    input.value = "";
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
        set(diceRef, "--");
    }
}
