// --- 1. IMPORTS (ONLY USE THIS SET) ---
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

// --- 3. INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 4. EXPORT FUNCTIONS TO HTML (Crucial step!) ---
// Because this is a module, the HTML cannot see the functions unless we attach them to 'window'
window.addPlayer = addPlayer;
window.rollDice = rollDice;
window.resetGame = resetGame;
window.updateMoney = updateMoney;
window.addProperty = addProperty;
window.deleteProperty = deleteProperty;

// --- 5. REALTIME LISTENERS ---

// Listener: Sync Players
const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    const playersGrid = document.getElementById("playersGrid");
    playersGrid.innerHTML = ""; // Clear existing cards
    const data = snapshot.val();

    if (data) {
        Object.keys(data).forEach(key => {
            renderPlayerCard(key, data[key]);
        });
    }
});

// Listener: Sync Logs
const logsRef = ref(db, 'logs');
onValue(logsRef, (snapshot) => {
    const list = document.getElementById("logList");
    list.innerHTML = "";
    const data = snapshot.val();
    if (data) {
        // Show newest logs first
        const logs = Object.values(data).reverse(); 
        logs.forEach(msg => {
            const li = document.createElement("li");
            li.innerHTML = msg; 
            list.appendChild(li);
        });
    }
});

// Listener: Sync Dice
const diceRef = ref(db, 'dice');
onValue(diceRef, (snapshot) => {
    const val = snapshot.val();
    if(val) document.getElementById("diceResult").textContent = val;
});

// --- 6. GAME FUNCTIONS ---

function addPlayer() {
    const input = document.getElementById("newPlayerName");
    const name = input.value.trim();
    if (!name) return;

    push(playersRef, {
        name: name,
        money: 1500,
        properties: {}
    });
    
    log(`<b>${name}</b> joined the game.`);
    input.value = "";
}

function renderPlayerCard(id, player) {
    const grid = document.getElementById("playersGrid");
    
    // Determine Color Badge
    let colorClass = "#10b981"; // Green
    if (player.money < 1000) colorClass = "#f59e0b"; // Orange
    if (player.money < 500) colorClass = "#ef4444"; // Red

    // Build Properties List HTML
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

    // Create Card Element
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="card-header">
            <h3>${player.name}</h3>
            <div class="money-badge" style="color:${colorClass}">$${player.money}</div>
        </div>
        
        <div class="control-row">
            <input type="number" id="amount-${id}" placeholder="Amount...">
            <button class="btn-add" onclick="updateMoney('${id}', '${player.name}', 1)">+</button>
            <button class="btn-pay" onclick="updateMoney('${id}', '${player.name}', -1)">-</button>
        </div>

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

function updateMoney(id, name, multiplier) {
    const input = document.getElementById(`amount-${id}`);
    const amount = parseInt(input.value);
    if (!amount) return;

    const pRef = ref(db, `players/${id}/money`);
    // Read current value once, then update
    onValue(pRef, (snap) => {
        const current = snap.val();
        const newVal = current + (amount * multiplier);
        set(pRef, newVal);
    }, { onlyOnce: true });

    const action = multiplier > 0 ? "received" : "paid";
    const color = multiplier > 0 ? "#10b981" : "#ef4444";
    log(`${name} ${action} <span style="color:${color}">$${amount}</span>`);
    input.value = "";
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
