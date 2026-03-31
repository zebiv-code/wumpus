// 3D Icosahedral cave renderer using WebGL with texture-mapped faces
import { CAVE } from './game.js';
import { ICO_VERTS, ICO_FACES, FACE_ROOM, getRoomPos } from './icosahedron.js';
import { perspective, lookAt, mul, quatFromAxisAngle, qslerp, quatToMatrix } from './math3d.js';

const SHRINK = 0.88;
const CAM_EYE = [0, 8, 11];
const camLen = Math.sqrt(CAM_EYE[0]**2 + CAM_EYE[1]**2 + CAM_EYE[2]**2);
const camDir = [CAM_EYE[0]/camLen, CAM_EYE[1]/camLen, CAM_EYE[2]/camLen];

function atlasUVRect(cellIdx) {
    const cols = 5, rows = 5;
    const col = cellIdx % cols, row = Math.floor(cellIdx / cols);
    const margin = 0.025;
    return {
        u0: col/cols + margin, v0: row/rows + margin,
        u1: (col+1)/cols - margin, v1: (row+1)/rows - margin,
    };
}

// Shrink a face's vertices toward its centroid
function shrinkFace(ai, bi, ci) {
    const a = ICO_VERTS[ai], b = ICO_VERTS[bi], c = ICO_VERTS[ci];
    const cx = (a[0]+b[0]+c[0])/3, cy = (a[1]+b[1]+c[1])/3, cz = (a[2]+b[2]+c[2])/3;
    return {
        sa: [cx+(a[0]-cx)*SHRINK, cy+(a[1]-cy)*SHRINK, cz+(a[2]-cz)*SHRINK],
        sb: [cx+(b[0]-cx)*SHRINK, cy+(b[1]-cy)*SHRINK, cz+(b[2]-cz)*SHRINK],
        sc: [cx+(c[0]-cx)*SHRINK, cy+(c[1]-cy)*SHRINK, cz+(c[2]-cz)*SHRINK],
        center: [cx, cy, cz],
    };
}

export function createCaveRenderer(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return null;

    // Overlay for click detection
    const overlay = document.createElement('canvas');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:auto;cursor:default;';
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(overlay);
    const ctx2d = overlay.getContext('2d');

    // --- Shaders ---
    function mkShader(src, type) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }

    const flatProg = gl.createProgram();
    gl.attachShader(flatProg, mkShader(`
        attribute vec3 aPos; attribute vec3 aCol; uniform mat4 uMVP;
        varying vec3 vCol;
        void main() { gl_Position = uMVP * vec4(aPos,1.0); vCol = aCol; }
    `, gl.VERTEX_SHADER));
    gl.attachShader(flatProg, mkShader(`
        precision mediump float; varying vec3 vCol;
        void main() { gl_FragColor = vec4(vCol, 1.0); }
    `, gl.FRAGMENT_SHADER));
    gl.linkProgram(flatProg);
    const flatLoc = {
        pos: gl.getAttribLocation(flatProg, 'aPos'),
        col: gl.getAttribLocation(flatProg, 'aCol'),
        mvp: gl.getUniformLocation(flatProg, 'uMVP'),
    };

    const texProg = gl.createProgram();
    gl.attachShader(texProg, mkShader(`
        attribute vec3 aPos; attribute vec2 aUV; uniform mat4 uMVP;
        varying vec2 vUV;
        void main() { gl_Position = uMVP * vec4(aPos,1.0); vUV = aUV; }
    `, gl.VERTEX_SHADER));
    gl.attachShader(texProg, mkShader(`
        precision mediump float; varying vec2 vUV; uniform sampler2D uTex;
        void main() { vec4 c = texture2D(uTex, vUV); if (c.a < 0.1) discard; gl_FragColor = c; }
    `, gl.FRAGMENT_SHADER));
    gl.linkProgram(texProg);
    const texLoc = {
        pos: gl.getAttribLocation(texProg, 'aPos'),
        uv: gl.getAttribLocation(texProg, 'aUV'),
        mvp: gl.getUniformLocation(texProg, 'uMVP'),
        tex: gl.getUniformLocation(texProg, 'uTex'),
    };

    // --- Atlas texture ---
    const atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
    const atlasImg = new Image();
    atlasImg.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, atlasTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImg);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    atlasImg.src = 'images/atlas.png';

    // --- State ---
    let lastPlayerRoom = -1;
    let currentQuat = [0,0,0,1], targetQuat = [0,0,0,1];
    let renderMode = 'move';
    const screenTriangles = {}, screenPositions = {};
    let onRoomClick = null;

    // --- Click detection ---
    function ptInTri(px,py,ax,ay,bx,by,cx,cy) {
        const d1=(px-bx)*(ay-by)-(ax-bx)*(py-by);
        const d2=(px-cx)*(by-cy)-(bx-cx)*(py-cy);
        const d3=(px-ax)*(cy-ay)-(cx-ax)*(py-ay);
        return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
    }
    function hitTest(mx, my) {
        for (const [room, tri] of Object.entries(screenTriangles))
            if (ptInTri(mx,my, tri[0].x,tri[0].y, tri[1].x,tri[1].y, tri[2].x,tri[2].y))
                return Number(room);
        return null;
    }
    overlay.addEventListener('click', e => {
        if (!onRoomClick) return;
        const r = overlay.getBoundingClientRect();
        const room = hitTest(e.clientX-r.left, e.clientY-r.top);
        if (room !== null) onRoomClick(room);
    });
    overlay.addEventListener('mousemove', e => {
        const r = overlay.getBoundingClientRect();
        overlay.style.cursor = hitTest(e.clientX-r.left, e.clientY-r.top) !== null ? 'pointer' : 'default';
    });

    // --- Helper: upload buffer and draw ---
    function drawArrayBuf(prog, attrs, mode, count) {
        gl.useProgram(prog);
        for (const { loc, buf, size } of attrs) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        }
        gl.drawArrays(mode, 0, count);
        for (const { buf } of attrs) gl.deleteBuffer(buf);
    }

    function makeBuf(data) {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
        return b;
    }

    // --- Render ---
    function render(gameState, gameObj) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

        gl.viewport(0, 0, w, h);
        gl.clearColor(0.02, 0.02, 0.06, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        // Rotation via quaternion slerp
        if (gameState.player !== lastPlayerRoom) {
            targetQuat = quatFromAxisAngle(getRoomPos(gameState.player), camDir);
            if (lastPlayerRoom === -1) currentQuat = targetQuat.slice();
            lastPlayerRoom = gameState.player;
        }
        currentQuat = qslerp(currentQuat, targetQuat, 0.06);
        const rotMat = quatToMatrix(currentQuat);
        const mvp = mul(perspective(Math.PI/4, w/h, 0.1, 100), mul(lookAt(CAM_EYE, [0,0,0], [0,1,0]), rotMat));

        const adj = CAVE[gameState.player];
        const faceV = [], faceC = [], edgeV = [], edgeC = [], texV = [], texUV = [];

        // Build geometry for all 20 faces
        for (let f = 0; f < 20; f++) {
            const room = FACE_ROOM[f];
            const [ai, bi, ci] = ICO_FACES[f];
            const { sa, sb, sc, center } = shrinkFace(ai, bi, ci);
            const a = ICO_VERTS[ai], b = ICO_VERTS[bi], c = ICO_VERTS[ci];
            const isPlayer = room === gameState.player, isAdj = adj.includes(room);

            // Face color
            let col;
            if (isPlayer) col = [0.15, 0.85, 0.3];
            else if (isAdj) {
                if (renderMode === 'shoot') {
                    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
                    col = [0.9*pulse+0.2, 0.1, 0.1];
                } else col = [0.2, 0.5, 0.9];
            } else col = [0.15, 0.22, 0.18];

            faceV.push(...sa, ...sb, ...sc);
            faceC.push(...col, ...col, ...col);

            // Edges
            const ec = (isPlayer || isAdj) ? [0.3, 0.7, 0.4] : [0.06, 0.1, 0.06];
            edgeV.push(...sa,...sb, ...sb,...sc, ...sc,...sa);
            for (let i = 0; i < 6; i++) edgeC.push(...ec);

            // Textured quad for active faces
            if (isPlayer || isAdj) {
                const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
                const e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
                const fn = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
                const fnl = Math.sqrt(fn[0]**2+fn[1]**2+fn[2]**2);
                fn[0]/=fnl; fn[1]/=fnl; fn[2]/=fnl;
                const lift = 0.02;
                const qc = [center[0]+fn[0]*lift, center[1]+fn[1]*lift, center[2]+fn[2]*lift];
                const e1l = Math.sqrt(e1[0]**2+e1[1]**2+e1[2]**2);
                const rx=e1[0]/e1l, ry=e1[1]/e1l, rz=e1[2]/e1l;
                const ux=fn[1]*rz-fn[2]*ry, uy=fn[2]*rx-fn[0]*rz, uz=fn[0]*ry-fn[1]*rx;

                function addQuad(ctr, hs, cellIdx) {
                    const uv = atlasUVRect(cellIdx);
                    const tl=[ctr[0]-rx*hs+ux*hs,ctr[1]-ry*hs+uy*hs,ctr[2]-rz*hs+uz*hs];
                    const tr=[ctr[0]+rx*hs+ux*hs,ctr[1]+ry*hs+uy*hs,ctr[2]+rz*hs+uz*hs];
                    const br=[ctr[0]+rx*hs-ux*hs,ctr[1]+ry*hs-uy*hs,ctr[2]+rz*hs-uz*hs];
                    const bl=[ctr[0]-rx*hs-ux*hs,ctr[1]-ry*hs-uy*hs,ctr[2]-rz*hs-uz*hs];
                    texV.push(...tl,...tr,...br, ...tl,...br,...bl);
                    texUV.push(uv.u0,uv.v0, uv.u1,uv.v0, uv.u1,uv.v1, uv.u0,uv.v0, uv.u1,uv.v1, uv.u0,uv.v1);
                }

                addQuad(qc, 0.55, room - 1);

                if (isPlayer && gameObj) {
                    const warnings = gameObj.getWarnings();
                    for (const w of warnings) {
                        const ci = w.type==='wumpus' ? 20 : w.type==='pit' ? 21 : 22;
                        addQuad(qc, 0.65, ci);
                    }
                }
            }
        }

        // Draw faces
        gl.uniformMatrix4fv(flatLoc.mvp, false, mvp);
        drawArrayBuf(flatProg,
            [{ loc: flatLoc.pos, buf: makeBuf(faceV), size: 3 }, { loc: flatLoc.col, buf: makeBuf(faceC), size: 3 }],
            gl.TRIANGLES, faceV.length / 3);

        // Draw edges
        gl.useProgram(flatProg);
        gl.uniformMatrix4fv(flatLoc.mvp, false, mvp);
        drawArrayBuf(flatProg,
            [{ loc: flatLoc.pos, buf: makeBuf(edgeV), size: 3 }, { loc: flatLoc.col, buf: makeBuf(edgeC), size: 3 }],
            gl.LINES, edgeV.length / 3);

        // Draw textured quads
        if (texV.length > 0) {
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            gl.useProgram(texProg);
            gl.uniformMatrix4fv(texLoc.mvp, false, mvp);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, atlasTex);
            gl.uniform1i(texLoc.tex, 0);

            gl.disableVertexAttribArray(flatLoc.pos);
            gl.disableVertexAttribArray(flatLoc.col);

            drawArrayBuf(texProg,
                [{ loc: texLoc.pos, buf: makeBuf(texV), size: 3 }, { loc: texLoc.uv, buf: makeBuf(texUV), size: 2 }],
                gl.TRIANGLES, texV.length / 3);

            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
        }

        // Click hit-testing (invisible overlay)
        const ow = canvas.clientWidth, oh = canvas.clientHeight;
        const odpr = window.devicePixelRatio || 1;
        if (overlay.width !== ow*odpr || overlay.height !== oh*odpr) {
            overlay.width = ow*odpr; overlay.height = oh*odpr;
            overlay.style.width = ow+'px'; overlay.style.height = oh+'px';
        }
        ctx2d.setTransform(odpr, 0, 0, odpr, 0, 0);
        ctx2d.clearRect(0, 0, ow, oh);

        function projectRaw(p) {
            const cx2=mvp[0]*p[0]+mvp[4]*p[1]+mvp[8]*p[2]+mvp[12];
            const cy2=mvp[1]*p[0]+mvp[5]*p[1]+mvp[9]*p[2]+mvp[13];
            const cw2=mvp[3]*p[0]+mvp[7]*p[1]+mvp[11]*p[2]+mvp[15];
            return { x: (cx2/cw2*0.5+0.5)*ow, y: (1-(cy2/cw2*0.5+0.5))*oh };
        }

        function transformPt(p) {
            const m = rotMat;
            return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2], m[1]*p[0]+m[5]*p[1]+m[9]*p[2], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]];
        }

        for (const k of Object.keys(screenTriangles)) delete screenTriangles[k];
        for (const k of Object.keys(screenPositions)) delete screenPositions[k];

        for (let f = 0; f < 20; f++) {
            const room = FACE_ROOM[f];
            if (room === gameState.player) continue;
            const [ai, bi, ci] = ICO_FACES[f];
            const tp = transformPt(getRoomPos(room));
            const nl = Math.sqrt(tp[0]**2+tp[1]**2+tp[2]**2);
            const d = (tp[0]/nl)*(CAM_EYE[0]-tp[0])+(tp[1]/nl)*(CAM_EYE[1]-tp[1])+(tp[2]/nl)*(CAM_EYE[2]-tp[2]);
            if (d <= 0) continue;
            const sv = [ai,bi,ci].map(vi => projectRaw(ICO_VERTS[vi]));
            screenTriangles[room] = sv;
            screenPositions[room] = { x: (sv[0].x+sv[1].x+sv[2].x)/3, y: (sv[0].y+sv[1].y+sv[2].y)/3 };
        }
    }

    return {
        render, getRoomPos,
        setOnRoomClick: cb => { onRoomClick = cb; },
        setMode: m => { renderMode = m; },
    };
}
