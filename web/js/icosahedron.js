// Icosahedron geometry and room-to-face mapping
import { CAVE } from './game.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const SCALE = 3.0;

export const ICO_VERTS = [
    [0,  1,  PHI], [0, -1,  PHI], [0,  1, -PHI], [0, -1, -PHI],
    [ 1,  PHI, 0], [-1,  PHI, 0], [ 1, -PHI, 0], [-1, -PHI, 0],
    [ PHI, 0,  1], [-PHI, 0,  1], [ PHI, 0, -1], [-PHI, 0, -1],
].map(v => {
    const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/l*SCALE, v[1]/l*SCALE, v[2]/l*SCALE];
});

export const ICO_FACES = [
    [0,1,8],  [0,8,4],  [0,4,5],  [0,5,9],  [0,9,1],
    [1,6,8],  [8,6,10], [8,10,4], [4,10,2], [4,2,5],
    [5,2,11], [5,11,9], [9,11,7], [9,7,1],  [1,7,6],
    [3,6,7],  [3,7,11], [3,11,2], [3,2,10], [3,10,6],
];

// Map icosahedron faces to dodecahedron rooms via adjacency matching
export const FACE_ROOM = buildFaceRoomMap();

function buildFaceRoomMap() {
    const faceAdj = Array.from({length: 20}, () => []);
    for (let i = 0; i < 20; i++)
        for (let j = i + 1; j < 20; j++) {
            let shared = 0;
            for (const v of ICO_FACES[i]) if (ICO_FACES[j].includes(v)) shared++;
            if (shared === 2) { faceAdj[i].push(j); faceAdj[j].push(i); }
        }

    const f2r = new Array(20).fill(-1), r2f = new Array(21).fill(-1);
    function tryMap(fi) {
        if (fi >= 20) return true;
        if (f2r[fi] !== -1) return tryMap(fi + 1);
        const cands = new Set();
        for (const af of faceAdj[fi])
            if (f2r[af] !== -1) for (const n of CAVE[f2r[af]]) if (r2f[n] === -1) cands.add(n);
        if (cands.size === 0) for (let r = 1; r <= 20; r++) if (r2f[r] === -1) cands.add(r);
        for (const room of cands) {
            let ok = true;
            for (const af of faceAdj[fi])
                if (f2r[af] !== -1 && !CAVE[room].includes(f2r[af])) { ok = false; break; }
            if (!ok) continue;
            f2r[fi] = room; r2f[room] = fi;
            if (tryMap(fi + 1)) return true;
            f2r[fi] = -1; r2f[room] = -1;
        }
        return false;
    }
    tryMap(0);
    return f2r;
}

export function getRoomPos(room) {
    for (let f = 0; f < 20; f++)
        if (FACE_ROOM[f] === room) {
            const [a, b, c] = ICO_FACES[f];
            return [
                (ICO_VERTS[a][0] + ICO_VERTS[b][0] + ICO_VERTS[c][0]) / 3,
                (ICO_VERTS[a][1] + ICO_VERTS[b][1] + ICO_VERTS[c][1]) / 3,
                (ICO_VERTS[a][2] + ICO_VERTS[b][2] + ICO_VERTS[c][2]) / 3,
            ];
        }
    return [0, 0, 0];
}
