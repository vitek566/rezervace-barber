import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Tvůj Firebase kód
const firebaseConfig = {
    apiKey: "AIzaSyCp5hXLowXTeA1Bpvk5WtNKAvkxM1_sLHU",
    authDomain: "projekt-barber-david.firebaseapp.com",
    projectId: "projekt-barber-david",
    storageBucket: "projekt-barber-david.firebasestorage.app",
    messagingSenderId: "704131848134",
    appId: "1:704131848134:web:8a57f69214344b34d3c4c7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let bookings = [];
let availability = {};
let selectedDate = null;
let isAdmin = false;
let currentView = 'pending';

// --- NAČÍTÁNÍ DAT ---
onValue(ref(db, 'bookings'), (snap) => {
    const data = snap.val();
    bookings = data ? Object.entries(data).map(([id, val]) => ({id, ...val})) : [];
    refreshUI();
});

onValue(ref(db, 'availability'), (snap) => {
    availability = snap.val() || {};
    refreshUI();
});

function refreshUI() {
    renderDays();
    if(selectedDate) {
        const conf = availability[selectedDate] || {status:'open', start:8, end:16};
        renderSlots(selectedDate, conf);
    }
    if(isAdmin) {
        updateStats();
        window.renderBarberOrders(currentView);
    }
}

// --- ZÁKAZNICKÁ ČÁST ---
function renderDays() {
    const container = document.getElementById('days-container');
    if(!container) return;
    container.innerHTML = '';
    for(let i=0; i<14; i++) {
        let dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + i);
        let dateStr = dateObj.toISOString().split('T')[0];
        const conf = availability[dateStr] || {status:'open'};

        if(conf.status === 'open' || isAdmin) {
            const card = document.createElement('div');
            card.className = `day-card ${selectedDate === dateStr ? 'active' : ''}`;
            card.innerHTML = `<strong>${dateStr.split('-')[2]}.${dateStr.split('-')[1]}.</strong>`;
            card.onclick = () => { selectedDate = dateStr; refreshUI(); };
            container.appendChild(card);
        }
    }
}

function renderSlots(date, conf) {
    const container = document.getElementById('slots-container');
    if(!container) return;
    container.innerHTML = '';
    for(let h = conf.start; h < conf.end; h++) {
        const time = `${h.toString().padStart(2,'0')}:00`;
        const taken = bookings.some(b => b.date === date && b.time === time);
        const slot = document.createElement('div');
        slot.className = `slot ${taken ? 'taken' : ''}`;
        slot.innerText = time;
        if(!taken) slot.onclick = () => {
            const name = document.getElementById('cust-name').value.trim();
            if(!name) return alert("Zadej své jméno!");
            if(confirm(`Rezervovat na ${date} v ${time}?`)) {
                push(ref(db, 'bookings'), { name, date, time, status: 'pending' });
                alert("Rezervace OK!");
            }
        };
        container.appendChild(slot);
    }
}

// --- BARBER ADMIN ---
window.loginPrompt = () => {
    if(prompt("Kód Barbera:") === "1234") { // Tady si změň heslo
        isAdmin = true;
        document.getElementById('view-customer').classList.add('hidden');
        document.getElementById('view-barber').classList.remove('hidden');
        document.getElementById('admin-login-btn').classList.add('hidden');
        refreshUI();
    } else { alert("Špatný kód!"); }
};

window.renderBarberOrders = (view) => {
    currentView = view;
    const container = document.getElementById('barber-content');
    if(!container) return;
    container.innerHTML = `<h3>${view === 'pending' ? 'Aktivní klienti' : 'Historie'}</h3>`;
    
    const filtered = bookings.filter(b => b.status === view).sort((a,b) => a.date.localeCompare(b.date));
    
    filtered.forEach(b => {
        const div = document.createElement('div');
        div.className = 'card flex-between';
        div.innerHTML = `<div><strong>${b.date} v ${b.time}</strong><br>${b.name}</div>
            <div style="display:flex; gap:10px;">
                ${view === 'pending' ? `<button class="btn" style="background:var(--success)" onclick="window.updateStatus('${b.id}', 'done')">Hotovo</button>` : ''}
                <button class="btn btn-outline" style="border-color:var(--danger); color:var(--danger)" onclick="window.deleteOrder('${b.id}')">Smazat</button>
            </div>`;
        container.appendChild(div);
    });
};

window.updateStatus = (id, stat) => {
    update(ref(db, `bookings/${id}`), {status: stat}).then(() => {
        currentView = 'done'; // Po kliknutí na Hotovo přepne do historie
        refreshUI();
    });
};

window.deleteOrder = (id) => {
    if(confirm("Opravdu smazat?")) remove(ref(db, `bookings/${id}`));
};

window.showScheduleSetup = () => {
    const container = document.getElementById('barber-content');
    container.innerHTML = `<h3>Nastavení rozvrhu</h3>`;
    for(let i=0; i<7; i++) {
        let d = new Date(); d.setDate(d.getDate() + i);
        let ds = d.toISOString().split('T')[0];
        const conf = availability[ds] || {status:'open', start:8, end:16};
        container.innerHTML += `<div class="setup-grid" data-date="${ds}">
            <strong>${ds}</strong>
            <select class="set-status">
                <option value="open" ${conf.status==='open'?'selected':''}>Otevřeno</option>
                <option value="closed" ${conf.status==='closed'?'selected':''}>Zavřeno</option>
            </select>
            <input type="number" class="set-start" value="${conf.start}">
            <input type="number" class="set-end" value="${conf.end}">
        </div>`;
    }
    container.innerHTML += `<button class="btn" style="width:100%; margin-top:15px;" onclick="window.saveSchedule()">Uložit vše</button>`;
};

window.saveSchedule = () => {
    const data = {};
    document.querySelectorAll('.setup-grid').forEach(el => {
        data[el.dataset.date] = {
            status: el.querySelector('.set-status').value,
            start: parseInt(el.querySelector('.set-start').value),
            end: parseInt(el.querySelector('.set-end').value)
        };
    });
    set(ref(db, 'availability'), data).then(() => alert("Rozvrh uložen!"));
};

// --- LOGIKA LEVELŮ ---
function updateStats() {
    const doneCount = bookings.filter(b => b.status === 'done').length;
    let level = 1, xpPrev = 0, xpNext = 10;

    if (doneCount >= 10) { level = 2; xpPrev = 10; xpNext = 25; }
    if (doneCount >= 25) { level = 3; xpPrev = 25; xpNext = 50; }
    if (doneCount >= 50) { level = 4; xpPrev = 50; xpNext = 100; }
    if (doneCount >= 100) { level = 5; xpPrev = 100; xpNext = 250; }

    const zbývá = xpNext - doneCount;
    const procenta = ((doneCount - xpPrev) / (xpNext - xpPrev)) * 100;

    document.getElementById('barber-level-text').innerText = `LEVEL ${level}`;
    document.getElementById('st-count').innerText = doneCount;
    document.getElementById('st-next').innerText = zbývá > 0 ? zbývá : "MAX";
    document.getElementById('chart-fill').style.width = `${Math.min(procenta, 100)}%`;
}