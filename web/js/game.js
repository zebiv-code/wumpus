// Hunt the Wumpus game logic
// Faithful to Gregory Yob's 1973 original

// Dodecahedral cave: 20 rooms, each connected to 3 others
export const CAVE = [
    null, // 1-indexed
    [2,5,8],   [1,3,10],  [2,4,12],  [3,5,14],  [1,4,6],
    [5,7,15],  [6,8,17],  [1,7,9],   [8,10,18], [2,9,11],
    [10,12,19],[3,11,13], [12,14,20],[4,13,15], [6,14,16],
    [15,17,20],[7,16,18], [9,17,19], [11,18,20],[13,16,19],
];

export function createGame() {
    const state = {
        player: 0,
        wumpus: 0,
        pits: [0, 0],
        bats: [0, 0],
        arrows: 5,
        gameOver: false,
        won: false,
        messages: [],
        savedPositions: null,
    };

    function rnd(n) { return Math.floor(Math.random() * n) + 1; }

    function placeEntities() {
        const positions = [];
        while (positions.length < 6) {
            const r = rnd(20);
            if (!positions.includes(r)) positions.push(r);
        }
        state.player = positions[0];
        state.wumpus = positions[1];
        state.pits = [positions[2], positions[3]];
        state.bats = [positions[4], positions[5]];
        state.arrows = 5;
        state.gameOver = false;
        state.won = false;
        state.messages = [];
        state.savedPositions = positions.slice();
    }

    function neighbors(room) { return CAVE[room]; }

    function getWarnings() {
        const warnings = [];
        const adj = neighbors(state.player);
        for (const r of adj) {
            if (r === state.wumpus) warnings.push({ type: 'wumpus', text: 'I smell a Wumpus!' });
            if (state.pits.includes(r)) warnings.push({ type: 'pit', text: 'I feel a draft!' });
            if (state.bats.includes(r)) warnings.push({ type: 'bat', text: 'Bats nearby!' });
        }
        return warnings;
    }

    // Returns hazard indicators for a specific adjacent room
    function getRoomHazards(room) {
        const hazards = [];
        if (room === state.wumpus) hazards.push('wumpus');
        if (state.pits.includes(room)) hazards.push('pit');
        if (state.bats.includes(room)) hazards.push('bat');
        return hazards;
    }

    function moveWumpus() {
        const k = rnd(4);
        if (k < 4) {
            state.wumpus = CAVE[state.wumpus][k - 1];
        }
        if (state.wumpus === state.player) {
            state.messages.push({ text: 'Tsk tsk tsk — Wumpus got you!', type: 'lose' });
            state.gameOver = true;
            state.won = false;
        }
    }

    function move(room) {
        if (state.gameOver) return;
        const adj = neighbors(state.player);
        if (!adj.includes(room) && room !== state.player) {
            state.messages.push({ text: 'Not possible!', type: 'event' });
            return false;
        }

        state.player = room;
        return checkHazards();
    }

    function checkHazards() {
        // Wumpus
        if (state.player === state.wumpus) {
            state.messages.push({ text: '...Oops! Bumped a Wumpus!', type: 'event' });
            moveWumpus();
            if (state.gameOver) return true;
        }

        // Pits
        if (state.pits.includes(state.player)) {
            state.messages.push({ text: 'YYYIIIIEEEE... fell in pit!', type: 'lose' });
            state.gameOver = true;
            state.won = false;
            return true;
        }

        // Bats
        if (state.bats.includes(state.player)) {
            state.messages.push({ text: 'ZAP — Super Bat snatch! Elsewhereville for you!', type: 'event' });
            state.player = rnd(20);
            return checkHazards();
        }

        return true;
    }

    function shoot(path) {
        if (state.gameOver) return;
        let arrowRoom = state.player;

        for (let i = 0; i < path.length; i++) {
            const target = path[i];
            const adj = CAVE[arrowRoom];

            if (adj.includes(target)) {
                arrowRoom = target;
            } else {
                // Arrow goes random
                arrowRoom = adj[rnd(3) - 1];
            }

            if (arrowRoom === state.wumpus) {
                state.messages.push({ text: 'AHA! You got the Wumpus!', type: 'win' });
                state.gameOver = true;
                state.won = true;
                return;
            }

            if (arrowRoom === state.player) {
                state.messages.push({ text: 'Ouch! Arrow got you!', type: 'lose' });
                state.gameOver = true;
                state.won = false;
                return;
            }
        }

        state.messages.push({ text: 'Missed!', type: 'event' });
        moveWumpus();

        state.arrows--;
        if (state.arrows <= 0 && !state.gameOver) {
            state.messages.push({ text: 'Out of arrows!', type: 'lose' });
            state.gameOver = true;
            state.won = false;
        }
    }

    function restart(sameSetup) {
        if (sameSetup && state.savedPositions) {
            const p = state.savedPositions;
            state.player = p[0];
            state.wumpus = p[1];
            state.pits = [p[2], p[3]];
            state.bats = [p[4], p[5]];
            state.arrows = 5;
            state.gameOver = false;
            state.won = false;
            state.messages = [];
        } else {
            placeEntities();
        }
    }

    placeEntities();

    return {
        state,
        neighbors,
        getWarnings,
        getRoomHazards,
        move,
        shoot,
        restart,
    };
}
