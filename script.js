// Import Firebase functions from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, update, set, remove } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBzH2VEhPHMYNVIWxtnrspGsg-Am8yN1fI",
  authDomain: "monoplymanager.firebaseapp.com",
  projectId: "monoplymanager",
  storageBucket: "monoplymanager.firebasestorage.app",
  messagingSenderId: "523334526288",
  appId: "1:523334526288:web:9c3a039c984edfa6477855",
  measurementId: "G-716Y6EQR1C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- GLOBAL REFERENCES ---
window.addPlayer = addPlayer;
window.rollDice = rollDice;
window.resetGame = resetGame;
window.updateMoney = updateMoney;
window.addProperty = addProperty;
window.deleteProperty = deleteProperty;

// --- REALTIME LISTENERS ---
// This listens for ANY change in the database and updates the screen
const playersRef = ref(db, 'players');
const logsRef = ref(db, 'logs');
const diceRef = ref(db, 'dice');

onValue(playersRef, (snapshot) => {
    const playersGrid = document.getElementById("playersGrid");
    playersGrid.innerHTML = ""; // Clear current
    const data = snapshot.val();

    if (data) {
        Object.keys(data).forEach(key => {
            const p = data[key];
            renderPlayerCard(key, p);
        });
    }
});

onValue(logsRef, (snapshot) => {
    const list = document.getElementById("logList");
    list.innerHTML = "";
    const data = snapshot.val();
    if (data) {
        // Convert object to array and reverse to show newest first
        const logs = Object.values(data).reverse(); 
        logs.forEach(msg => {
            const li = document.createElement("li");
            li.textContent = msg;
            list.appendChild(li);
        });
    }
});

onValue(diceRef, (snapshot) => {
    const val = snapshot.val();
    if(val) document.getElementById("diceResult").textContent = val;
});

// --- ACTIONS ---

function addPlayer() {
    const nameInput = document.getElementById("newPlayerName");
    const name = nameInput.value.trim();
    if (!name) return;

    // Push new player to DB
    push(playersRef, {
        name: name,
        money: 1500,
        properties: {}
    });
    
    log(`${name} joined the game.`);
    nameInput.value = "";
}

function renderPlayerCard(id, player) {
    const grid = document.getElementById("playersGrid");
    
    // Calculate color
    let color = "#00c853";
    if (player.money < 1000) color = "#ffab00";
    if (player.money < 500) color = "#ff1744";

    // Build Properties HTML
    let propsHtml = "";
    if (player.properties) {
        Object.entries(player.properties).forEach(([propId, propName]) => {
            propsHtml += `
            <div class="prop-item">
                <span><i class="fa-solid fa-house"></i> ${propName}</span>
                <button class="btn-del" onclick="deleteProperty('${id}', '${propId}', '${player.name}', '${propName}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        });
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="card-header">
            <h3>${player.name}</h3>
            <div class="money" style="color:${color}">$${player.money}</div>
        </div>
        
        <div class="controls">
            <input type="number" id="amount-${id}" placeholder="Amount">
            <button class="btn-add" onclick="updateMoney('${id}', '${player.name}', 1)">+</button>
            <button class="btn-pay" onclick="updateMoney('${id}', '${player.name}', -1)">-</button>
        </div>

        <div class="controls">
            <input type="text" id="prop-${id}" placeholder="New Property">
            <button style="background:#3d5afe; color:white" onclick="addProperty('${id}', '${player.name}')">Buy</button>
        </div>

        <div class="properties-list">
            ${propsHtml}
        </div>
    `;
    grid.appendChild(card);
}

function updateMoney(id, name, multiplier) {
    const input = document.getElementById(`amount-${id}`);
    const amount = parseInt(input.value);
    if (!amount) return;

    // We must read the current money first (simplified for this example)
    // In a real app we might use transaction(), but getting snapshot is easier for beginners
    getDatabase(app); 
    // Actually, we can use a transaction or simple read.
    // Let's use simple read for simplicity
    const pRef = ref(db, `players/${id}/money`);
    
    onValue(pRef, (snap) => {
        const current = snap.val();
        const newVal = current + (amount * multiplier);
        // Update DB (This will trigger the UI update automatically!)
        set(pRef, newVal);
    }, { onlyOnce: true });

    const action = multiplier > 0 ? "received" : "paid";
    log(`${name} ${action} $${amount}`);
    input.value = "";
}

function addProperty(id, name) {
    const input = document.getElementById(`prop-${id}`);
    const propName = input.value.trim();
    if (!propName) return;

    const propRef = ref(db, `players/${id}/properties`);
    push(propRef, propName);
    
    log(`${name} bought ${propName}`);
    input.value = "";
}

function deleteProperty(playerId, propId, playerName, propName) {
    remove(ref(db, `players/${playerId}/properties/${propId}`));
    log(`${playerName} sold/lost ${propName}`);
}

function rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    let msg = `${d1} + ${d2} = ${total}`;
    if (d1 === d2) msg += " (DOUBLES!)";
    
    set(diceRef, msg);
    log(`Dice: ${msg}`);
}

function log(msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    push(logsRef, `[${time}] ${msg}`);
}

function resetGame() {
    if(confirm("Are you sure you want to wipe all data?")) {
        set(playersRef, {});
        set(logsRef, {});
        set(diceRef, "Roll!");
    }
}
