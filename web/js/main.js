import { createGame } from './game.js';
import { createCaveRenderer } from './cave3d.js';

// --- DOM ---
const canvas = document.getElementById('cave-canvas');
const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const roomBtnsEl = document.getElementById('room-buttons');
const btnMove = document.getElementById('btn-move');
const btnShoot = document.getElementById('btn-shoot');
const arrowControls = document.getElementById('arrow-controls');
const arrowCountInput = document.getElementById('arrow-count');
const arrowPathEl = document.getElementById('arrow-path');
const btnFire = document.getElementById('btn-fire');
const arrowDisplay = document.getElementById('arrow-display');
const btnShootHud = document.getElementById('btn-shoot-hud');
const msgPane = document.getElementById('msg-pane');
let msgTimeout = null;

// --- State ---
let game = createGame();
const renderer = createCaveRenderer(canvas);
let mode = 'move';
let arrowPath = [];
let arrowRoomsNeeded = 1;

function showMessage(text, duration = 3000) {
    if (msgTimeout) clearTimeout(msgTimeout);
    msgPane.textContent = text;
    msgPane.classList.remove('hidden');
    // Re-trigger animation
    msgPane.style.animation = 'none';
    msgPane.offsetHeight; // force reflow
    msgPane.style.animation = '';
    msgTimeout = setTimeout(() => msgPane.classList.add('hidden'), duration);
}

function setMode(m) {
    mode = m;
    if (renderer) renderer.setMode(m);
    btnMove.classList.toggle('active', m === 'move');
    btnShoot.classList.toggle('active', m === 'shoot');
    btnShootHud.classList.toggle('active', m === 'shoot');
    arrowControls.classList.toggle('hidden', m !== 'shoot');
    if (m === 'move') arrowPath = [];
    updateArrowHud();
}

// ESC cancels shoot mode
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'shoot') {
        setMode('move');
    }
});

// --- 3D click handler ---
if (renderer) {
    renderer.setOnRoomClick((room) => onRoomClick(room));
}

// --- Arrow HUD ---
function updateArrowHud() {
    const s = game.state;
    arrowDisplay.innerHTML = `\u{1F3F9} ${'▸'.repeat(s.arrows)}${'·'.repeat(5 - s.arrows)} (${s.arrows})`;
    btnShootHud.classList.toggle('active', mode === 'shoot');
}

btnShootHud.addEventListener('click', () => {
    if (mode === 'shoot') {
        setMode('move');
    } else {
        setMode('shoot');
        arrowRoomsNeeded = Number(arrowCountInput.value) || 1;
        updateArrowPath();
    }
});

// --- Sidebar UI ---
function updateUI() {
    const s = game.state;
    const warnings = game.getWarnings();
    const adj = game.neighbors(s.player);

    // Status
    let html = `You are in room <span class="room-num">${s.player}</span><br>`;
    html += `Tunnels lead to: <strong>${adj.join(', ')}</strong><br>`;
    for (const w of warnings) {
        html += `<span class="warning ${w.type}">${w.text}</span>`;
    }
    statusEl.innerHTML = html;

    // Show warnings/events in the message pane
    const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
    if (warnings.length > 0) {
        showMessage(warnings.map(w => w.text).join('  '), 4000);
    } else if (lastMsg && (lastMsg.type === 'event' || lastMsg.type === 'win' || lastMsg.type === 'lose')) {
        showMessage(lastMsg.text, 4000);
    }

    // Arrow HUD
    updateArrowHud();

    // Room buttons
    roomBtnsEl.innerHTML = '';
    for (const r of adj) {
        const btn = document.createElement('button');
        btn.textContent = `Room ${r}`;
        btn.addEventListener('click', () => onRoomClick(r));
        roomBtnsEl.appendChild(btn);
    }

    // Messages
    messagesEl.innerHTML = '';
    for (const m of s.messages.slice(-10)) {
        const div = document.createElement('div');
        div.className = 'msg ' + (m.type || '');
        div.textContent = m.text;
        messagesEl.appendChild(div);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Game over
    const existing = document.getElementById('game-over');
    if (existing) existing.remove();

    if (s.gameOver) {
        const overlay = document.createElement('div');
        overlay.id = 'game-over';
        overlay.className = s.won ? 'win' : 'lose';
        overlay.innerHTML = `
            <h2>${s.won ? 'YOU WIN!' : 'YOU LOSE!'}</h2>
            <p>${s.won ? "Hee hee hee — the Wumpus'll getcha next time!!" : 'Ha ha ha — you lose!'}</p>
            <button id="go-new">New Game</button>
            <button id="go-same">Same Setup</button>
        `;
        document.body.appendChild(overlay);
        document.getElementById('go-new').addEventListener('click', () => {
            overlay.remove(); game.restart(false); updateUI();
        });
        document.getElementById('go-same').addEventListener('click', () => {
            overlay.remove(); game.restart(true); updateUI();
        });
    }
}

// --- Room interaction ---
function onRoomClick(room) {
    if (game.state.gameOver) return;

    if (mode === 'move') {
        // Only allow moving to adjacent rooms
        const adj = game.neighbors(game.state.player);
        if (!adj.includes(room)) return;
        game.move(room);
        updateUI();
    } else {
        // Shoot mode — click any visible room to add to arrow path
        if (arrowPath.length >= arrowRoomsNeeded) return;
        if (arrowPath.length >= 2 && room === arrowPath[arrowPath.length - 2]) {
            game.state.messages.push({ text: "Arrows aren't that crooked — try another room", type: 'event' });
            updateUI();
            return;
        }
        arrowPath.push(room);
        updateArrowPath();
        if (arrowPath.length >= arrowRoomsNeeded) {
            game.shoot(arrowPath);
            setMode('move');
            updateUI();
        }
    }
}

function updateArrowPath() {
    arrowPathEl.innerHTML = '';
    for (const r of arrowPath) {
        const span = document.createElement('span');
        span.className = 'arrow-room';
        span.textContent = r;
        arrowPathEl.appendChild(span);
    }
    for (let i = arrowPath.length; i < arrowRoomsNeeded; i++) {
        const span = document.createElement('span');
        span.className = 'arrow-room';
        span.textContent = '?';
        span.style.opacity = '0.3';
        arrowPathEl.appendChild(span);
    }
}

// --- Sidebar mode buttons ---
btnMove.addEventListener('click', () => setMode('move'));
btnShoot.addEventListener('click', () => {
    setMode('shoot');
    arrowRoomsNeeded = Number(arrowCountInput.value) || 1;
    updateArrowPath();
});

arrowCountInput.addEventListener('input', () => {
    arrowRoomsNeeded = Math.max(1, Math.min(5, Number(arrowCountInput.value) || 1));
    arrowPath = arrowPath.slice(0, arrowRoomsNeeded);
    updateArrowPath();
});

btnFire.addEventListener('click', () => {
    if (arrowPath.length === 0) return;
    game.shoot(arrowPath);
    setMode('move');
    updateUI();
});

// --- Rules modal ---
const rulesModal = document.getElementById('rules-modal');
document.getElementById('btn-rules').addEventListener('click', () => rulesModal.classList.remove('hidden'));
rulesModal.querySelector('.rules-close').addEventListener('click', () => rulesModal.classList.add('hidden'));
rulesModal.addEventListener('click', e => { if (e.target === rulesModal) rulesModal.classList.add('hidden'); });

// --- Render loop ---
function animate() {
    if (renderer) renderer.render(game.state, game);
    requestAnimationFrame(animate);
}

updateUI();
animate();
