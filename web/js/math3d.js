// 3D math utilities — column-major matrices, quaternions

export function perspective(fov, asp, near, far) {
    const f = 1 / Math.tan(fov / 2), ri = 1 / (near - far);
    return new Float32Array([f/asp,0,0,0, 0,f,0,0, 0,0,(near+far)*ri,-1, 0,0,near*far*ri*2,0]);
}

export function lookAt(e, c, u) {
    let zx=e[0]-c[0], zy=e[1]-c[1], zz=e[2]-c[2];
    let l=Math.sqrt(zx*zx+zy*zy+zz*zz); zx/=l; zy/=l; zz/=l;
    let xx=u[1]*zz-u[2]*zy, xy=u[2]*zx-u[0]*zz, xz=u[0]*zy-u[1]*zx;
    l=Math.sqrt(xx*xx+xy*xy+xz*xz); xx/=l; xy/=l; xz/=l;
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    return new Float32Array([
        xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
        -(xx*e[0]+xy*e[1]+xz*e[2]),
        -(yx*e[0]+yy*e[1]+yz*e[2]),
        -(zx*e[0]+zy*e[1]+zz*e[2]), 1
    ]);
}

export function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
    return o;
}

// --- Quaternions [x, y, z, w] ---

export function quatFromAxisAngle(from, to) {
    const fl = Math.sqrt(from[0]**2 + from[1]**2 + from[2]**2);
    const fx = from[0]/fl, fy = from[1]/fl, fz = from[2]/fl;
    const tl = Math.sqrt(to[0]**2 + to[1]**2 + to[2]**2);
    const tx = to[0]/tl, ty = to[1]/tl, tz = to[2]/tl;
    const dot = fx*tx + fy*ty + fz*tz;
    if (dot > 0.9999) return [0, 0, 0, 1];
    if (dot < -0.9999) return [0, 1, 0, 0];
    const ax = fy*tz - fz*ty, ay = fz*tx - fx*tz, az = fx*ty - fy*tx;
    const al = Math.sqrt(ax*ax + ay*ay + az*az);
    const half = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;
    const s = Math.sin(half);
    return [ax/al*s, ay/al*s, az/al*s, Math.cos(half)];
}

export function qslerp(a, b, t) {
    let dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
    const b2 = dot < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
    dot = Math.abs(dot);
    if (dot > 0.9995) {
        const r = [a[0]+(b2[0]-a[0])*t, a[1]+(b2[1]-a[1])*t, a[2]+(b2[2]-a[2])*t, a[3]+(b2[3]-a[3])*t];
        const l = Math.sqrt(r[0]**2 + r[1]**2 + r[2]**2 + r[3]**2);
        return [r[0]/l, r[1]/l, r[2]/l, r[3]/l];
    }
    const theta = Math.acos(dot), sinT = Math.sin(theta);
    const wa = Math.sin((1-t)*theta) / sinT, wb = Math.sin(t*theta) / sinT;
    return [wa*a[0]+wb*b2[0], wa*a[1]+wb*b2[1], wa*a[2]+wb*b2[2], wa*a[3]+wb*b2[3]];
}

export function quatToMatrix(q) {
    const [x, y, z, w] = q;
    return new Float32Array([
        1-2*(y*y+z*z), 2*(x*y+z*w),   2*(x*z-y*w),   0,
        2*(x*y-z*w),   1-2*(x*x+z*z), 2*(y*z+x*w),   0,
        2*(x*z+y*w),   2*(y*z-x*w),   1-2*(x*x+y*y), 0,
        0, 0, 0, 1
    ]);
}
