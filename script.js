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
let adminUid = null; 
let isRegistering = false;

// --- 4. DATABASE REFERENCES ---
const playersRef = ref(db, 'players');
const potRef = ref(db, 'pot');
const logsRef = ref(db, 'logs');
const diceRef = ref(db, 'dice');
const timerRef = ref(db, 'gameState/startTime');
const adminRef = ref(db, 'gameSettings/adminUid'); 

// --- 5. EXPORTS ---
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

window.handleEmailAuth = handleEmailAuth;
window.signInGoogle = signInGoogle;
window.signInAnon = signInAnon;
window.logout = logout;
window.toggleAuthMode = toggleAuthMode;
window.handlePasswordReset = handlePasswordReset;

// --- 6. AUTHENTICATION LOGIC ---

onAuthStateChanged(auth, (user) => {
    const overlay = document.getElementById("authOverlay");
    
    if (user) {
        currentUser = user;
        overlay.classList.add("hidden");
        initGameListeners();
        checkMode();
    } else {
        currentUser = null;
        overlay.classList.remove("hidden");
        detachGameListeners();
    }
});

async function signInGoogle() {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (e) { showAuthError(e.message); }
}

async function signInAnon() {
    try { await signInAnonymously(auth); } 
    catch (e) { showAuthError(e.message); }
}

async function handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;
    try {
        if (isRegistering) await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { showAuthError(e.message.replace("auth/", "")); }
}

function toggleAuthMode() {
    isRegistering = !isRegistering;
    document.getElementById("authBtnLabel").textContent = isRegistering ? "Create Account" : "Sign In";
    document.getElementById("toggleAuthText").textContent = isRegistering ? "Have an account? Sign In" : "Need an account? Register";
}

async function handlePasswordReset() {
    const email = document.getElementById("emailInput").value;
    if(!email) return showAuthError("Enter email.");
    try { await sendPasswordResetEmail(auth, email); alert("Sent!"); } 
    catch (e) { showAuthError(e.message); }
}

function logout() { signOut(auth); window.location.reload(); }
function showAuthError(msg) { document.getElementById("authError").textContent = msg; document.getElementById("authError").style.display = "block"; }

// --- 7. DATABASE LISTENERS ---

function initGameListeners() {
    onValue(adminRef, (snap) => {
        adminUid = snap.val();
        const bankerDisplay = document.getElementById("bankerNameDisplay");
        if (currentUser && adminUid === currentUser.uid) {
            document.body.classList.add('is-banker'); 
            if(bankerDisplay) bankerDisplay.textContent = "YOU 👑";
        } else {
            document.body.classList.remove('is-banker'); 
            if(bankerDisplay) bankerDisplay.textContent = "The Boss"; 
        }
    });

    onValue(playersRef, (snapshot) => {
        const playersGrid = document.getElementById("playersGrid");
        playersGrid.innerHTML = "";
        const data = snapshot.val();
        allPlayersData = data || {}; 
        updatePotDropdown();
        if (data) {
            const sorted = Object.entries(data).sort((a, b) => calculateNetWorth(a[1]) - calculateNetWorth(b[1])).reverse();
            sorted.forEach(([key, player]) => renderPlayerCard(key, player));
        }
    });

    onValue(potRef, (s) => document.getElementById("potAmount").textContent = `$${s.val() || 0}`);
    
    onValue(logsRef, (snapshot) => {
        const list = document.getElementById("logList");
        list.innerHTML = "";
        const data = snapshot.val();
        if (data) Object.values(data).reverse().forEach(msg => {
            const li = document.createElement("li");
            li.innerHTML = msg; list.appendChild(li);
        });
    });

    onValue(diceRef, (s) => { if(s.val()) document.getElementById("diceResult").innerHTML = s.val(); });

    onValue(timerRef, (snap) => {
        gameStartTime = snap.val();
        if(!gameStartTime && isAdmin(false)) set(timerRef, Date.now());
    });
}

function detachGameListeners() {
    off(playersRef); off(potRef); off(logsRef); off(diceRef); off(timerRef); off(adminRef);
}

setInterval(() => {
    const display = document.getElementById("gameTimer");
    if(!gameStartTime) { display.textContent = "00:00:00"; return; }
    const diff = Date.now() - gameStartTime;
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
    display.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}, 1000);

// --- 8. FUNCTIONS (ALL SECURED) ---

function isAdmin(showAlert = true) {
    if (currentUser && adminUid === currentUser.uid) return true;
    if (showAlert) alert("⛔ View Only Mode: Only the Banker can edit.");
    return false;
}

function addPlayer() {
    if(!isAdmin()) return;
    const input = document.getElementById("newPlayerName");
    const name = input.value.trim();
    if (!name) return;
    push(playersRef, { name, money: 1500, avatar: Math.floor(Math.random()*5000), isJailed: false, properties: {} });
    log(`<b>${name}</b> joined.`);
    input.value = "";
}

function rollDice() {
    if(!isAdmin()) return;
    const d1 = Math.floor(Math.random()*6)+1, d2 = Math.floor(Math.random()*6)+1;
    const i = ["⚀","⚁","⚂","⚃","⚄","⚅"];
    set(diceRef, `<span style="font-size:2rem">${i[d1-1]} ${i[d2-1]}</span><br><span style="font-size:1rem">${d1+d2}</span>`);
    log(`🎲 Rolled: ${d1} + ${d2} = <b>${d1+d2}</b>${d1===d2?" (DOUBLES!)":""}`);
}

function addToPot(amt) {
    if(!isAdmin()) return;
    onValue(potRef, (s) => { set(potRef, (s.val()||0)+amt); log(`Added <span style="color:#f59e0b">$${amt}</span> to Pot.`); }, { onlyOnce: true });
}

function claimPot() {
    if(!isAdmin()) return;
    const wid = document.getElementById("potWinner").value;
    if(!wid) return alert("Select a winner!");
    onValue(potRef, (snap) => {
        const val = snap.val() || 0; if(val === 0) return;
        performTransaction(wid, val); set(potRef, 0);
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        log(`🎰 <b>${allPlayersData[wid].name}</b> WON $${val} POT!`);
    }, { onlyOnce: true });
}

function resetGame() {
    if(!isAdmin()) return;
    if(confirm("⚠ NUKE GAME?")) {
        const updates = {};
        updates['players'] = null; updates['logs'] = null;
        updates['pot'] = 0; updates['dice'] = "--";
        updates['gameState/startTime'] = Date.now();
        update(ref(db), updates);
        log(`☢ <b>GAME NUKED</b> by Banker!`);
    }
}

// --- PLAYER MANAGEMENT (SECURED) ---

function updateMoney(id, name, mult) {
    if(!isAdmin()) return; // SECURE
    const input = document.getElementById(`amount-${id}`);
    const amt = parseInt(input.value); if (!amt) return;
    performTransaction(id, amt * mult);
    log(`${name} ${mult > 0 ? "received" : "paid"} <span style="color:${mult>0?"#10b981":"#ef4444"}">$${amt}</span>`);
    input.value = "";
}

function passGo(id, name) {
    if(!isAdmin()) return; // SECURE
    performTransaction(id, 200);
    confetti({ particleCount: 50, spread: 60, origin: { x: 0.5, y:0.8 } });
    log(`💸 ${name} passed GO (+$200)`);
}

function transferMoney(sid, sname) {
    if(!isAdmin()) return; // SECURE
    const inp = document.getElementById(`amount-${sid}`);
    const tid = document.getElementById(`transfer-${sid}`).value;
    const amt = parseInt(inp.value);
    if (!amt || !tid) return;
    performTransaction(sid, -amt); performTransaction(tid, amt);
    log(`${sname} paid <span style="color:#ef4444">$${amt}</span> to ${allPlayersData[tid].name}`);
    inp.value = "";
}

function addProperty(id, name) {
    if(!isAdmin()) return; // SECURE
    const n = document.getElementById(`prop-name-${id}`);
    const c = document.getElementById(`prop-cost-${id}`);
    const clr = document.getElementById(`prop-color-${id}`);
    if (!n.value || !c.value) return;
    push(ref(db, `players/${id}/properties`), { name: n.value.trim(), cost: parseInt(c.value), color: clr.value, mortgaged: false, houses: 0 });
    log(`${name} bought <b>${n.value}</b> for $${c.value}`);
    n.value = ""; c.value = "";
}

function deleteProperty(pid, prid, pname, propn) {
    if(!isAdmin()) return; // SECURE
    if(confirm(`Remove ${propn}?`)) { remove(ref(db, `players/${pid}/properties/${prid}`)); log(`${pname} lost <b>${propn}</b>`); }
}

function toggleMortgage(pid, prid) {
    if(!isAdmin()) return; // SECURE
    const r = ref(db, `players/${pid}/properties/${prid}/mortgaged`);
    onValue(r, (s) => set(r, !s.val()), { onlyOnce: true });
}

function updateHouses(playerId, propId, change) {
    if(!isAdmin()) return; // SECURE
    const propRef = ref(db, `players/${playerId}/properties/${propId}`);
    onValue(propRef, (snap) => {
        const prop = snap.val(); if(!prop) return;
        let houses = prop.houses || 0; let isHotel = prop.isHotel || false;
        if (change > 0) { if (!isHotel) { if (houses < 4) houses++; else { houses = 0; isHotel = true; } } } 
        else { if (isHotel) { isHotel = false; houses = 4; } else if (houses > 0) houses--; }
        update(propRef, { houses, isHotel });
    }, { onlyOnce: true });
}

function toggleJail(id) {
    if(!isAdmin()) return; // SECURE
    const r = ref(db, `players/${id}/isJailed`);
    onValue(r, (s) => { 
        set(r, !s.val()); 
        log(s.val() ? `🕊 ${allPlayersData[id].name} released.` : `🚔 ${allPlayersData[id].name} went to JAIL!`); 
    }, { onlyOnce: true });
}

function bankruptPlayer(id, name) {
    if(!isAdmin()) return; // SECURE
    if(confirm(`Bankrupt ${name}?`)) { remove(ref(db, `players/${id}`)); log(`☠ <b>${name}</b> WENT BANKRUPT!`); }
}

function performTransaction(id, amt) {
    // Internal helper, check performed by caller, but doubles as safety
    const r = ref(db, `players/${id}/money`);
    onValue(r, (s) => set(r, s.val() + amt), { onlyOnce: true });
}

// --- UI HELPERS ---

function calculateNetWorth(player) {
    let nw = player.money || 0;
    if(player.properties) {
        Object.values(player.properties).forEach(p => {
            if(!p.mortgaged) {
                nw += (parseInt(p.cost) || 0); 
                const houses = p.houses || 0;
                const isHotel = p.isHotel || false;
                if(isHotel) nw += 500; else nw += (houses * 100);
            } else { nw += (parseInt(p.cost) || 0) / 2; }
        });
    }
    return nw;
}

function updatePotDropdown() {
    const select = document.getElementById("potWinner");
    select.innerHTML = `<option value="">Select Winner...</option>`;
    Object.keys(allPlayersData).forEach(id => select.innerHTML += `<option value="${id}">${allPlayersData[id].name}</option>`);
}

function renderPlayerCard(id, player) {
    const grid = document.getElementById("playersGrid");
    let colorClass = player.money < 500 ? "#ef4444" : "#10b981"; 
    const netWorth = calculateNetWorth(player);

    let propsHtml = "";
    if (player.properties) {
        Object.entries(player.properties).forEach(([propId, propObj]) => {
            const houses = propObj.houses || 0;
            const isHotel = propObj.isHotel || false;
            let housePips = isHotel ? `<div class="hotel-pip"></div>` : "";
            if(!isHotel) for(let i=0; i<houses; i++) housePips += `<div class="house-pip"></div>`;

            propsHtml += `
            <div class="prop-tag prop-${propObj.color||"railroad"} ${propObj.mortgaged?"mortgaged":""}">
                <div class="prop-header"><span>${propObj.name}</span><div class="house-indicator">${housePips}</div></div>
                <div class="prop-details">
                    <div class="prop-actions">
                         <button class="btn-tiny" onclick="updateHouses('${id}', '${propId}', 1)">+🏠</button>
                         <button class="btn-tiny" onclick="updateHouses('${id}', '${propId}', -1)">-🏠</button>
                    </div>
                    <div class="prop-actions">
                        <button class="btn-tiny" onclick="toggleMortgage('${id}', '${propId}')"><i class="fa-solid fa-ban"></i></button>
                        <button class="btn-tiny" style="color:#ef4444" onclick="deleteProperty('${id}', '${propId}', '${player.name}', '${propObj.name}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
        });
    } else { propsHtml = `<div style="color:#64748b; font-size:0.8rem; text-align:center; padding:10px;">No properties</div>`; }

    let transferOptions = `<option value="">Select Player...</option>`;
    Object.keys(allPlayersData).forEach(otherId => { if(otherId !== id) transferOptions += `<option value="${otherId}">${allPlayersData[otherId].name}</option>`; });

    const card = document.createElement("div");
    card.className = `card ${player.isJailed ? "jailed" : ""}`;
    card.innerHTML = `
        <div class="card-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${player.avatar}" class="player-avatar">
                <div><h3 style="margin:0">${player.name}</h3><span class="jailed-badge">IN JAIL</span></div>
            </div>
            <div class="money-container"><div class="money-badge" style="color:${colorClass}">$${player.money}</div></div>
        </div>
        <div class="stats-row"><span>Net Worth: <span class="stat-val">$${netWorth}</span></span><span>Props: <span class="stat-val">${Object.keys(player.properties || {}).length}</span></span></div>
        <button class="btn-go" onclick="passGo('${id}', '${player.name}')" ${player.isJailed ? 'disabled' : ''}><i class="fa-solid fa-arrow-right-to-bracket"></i> PASS GO (+$200)</button>
        <div class="control-row" style="margin-top:10px">
            <input type="number" id="amount-${id}" placeholder="$$$">
            <button class="btn-add" onclick="updateMoney('${id}', '${player.name}', 1)">+</button>
            <button class="btn-pay" onclick="updateMoney('${id}', '${player.name}', -1)">-</button>
        </div>
        <div class="control-row" style="margin-top:5px;">
            <select id="transfer-${id}" style="border-radius:8px; padding:8px; border:none; width:70%">${transferOptions}</select>
            <button class="btn-pay" style="width:30%; padding:0 5px;" onclick="transferMoney('${id}', '${player.name}')">Pay</button>
        </div>
        <div style="border-top:1px solid #334155; margin: 10px 0;"></div>
        <div class="control-row">
            <input type="text" id="prop-name-${id}" placeholder="Name..." style="width:50%">
            <input type="number" id="prop-cost-${id}" placeholder="$ Cost" style="width:25%">
            <select id="prop-color-${id}" style="width:25%;">
                <option value="brown">🟫</option><option value="lightblue">💠</option><option value="pink">🎀</option><option value="orange">🟧</option>
                <option value="red">🟥</option><option value="yellow">🟨</option><option value="green">🟩</option><option value="blue">🟦</option>
                <option value="railroad">🚂</option><option value="utility">💡</option>
            </select>
        </div>
        <button class="btn-buy" style="width:100%; margin-top:5px;" onclick="addProperty('${id}', '${player.name}')">Add Property</button>
        <div class="props-container" style="margin-top:10px;">${propsHtml}</div>
        <div style="display:flex; gap:5px; margin-top:5px">
             <button class="jail-btn" onclick="toggleJail('${id}')">${player.isJailed ? "RELEASE" : "JAIL"}</button>
             <button class="btn-danger jail-btn" onclick="bankruptPlayer('${id}', '${player.name}')">☠</button>
        </div>`;
    grid.appendChild(card);
}

function log(msg) {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    push(logsRef, `<span style="color:#64748b; font-size:0.8em">[${t}]</span> ${msg}`);
}

function checkMode() {
    if (!currentUser) document.body.classList.add('spectator');
    else document.body.classList.remove('spectator');
}
