"use strict";
const TWO_PI = 2 * Math.PI;
function clamp(x, min, max) {
    return x > max ? max : x < min ? min : x;
}
function lerp(x, y, t) {
    return x + t * (y - x);
}
function newtonRootSolve(f, df, x0, eps, maxIters = 1000) {
    let n = 0;
    let prevX = x0;
    let x = x0 - f(x0) / df(x0);
    while (Math.abs(x - prevX) > eps && n < maxIters) {
        prevX = x;
        x -= f(x) / df(x);
        n++;
    }
    return x;
}
function randomPointOnSphereRing(thetaMin, thetaMax) {
    return {
        theta: randomInInterval(thetaMin, thetaMax),
        phi: randomInInterval(0, TWO_PI)
    };
}
function pointOnSphereRing(dir, theta, phi) {
    let axis = normalize3(cross(dir, vec3(1, 0, 0)));
    let point = rotate3(dir, axis, theta);
    point = rotate3(point, dir, phi);
    return point;
}
function minMaxRingAngle(r, rmin, rmax) {
    return {
        thetaMin: Math.asin(rmin / r),
        thetaMax: Math.asin(rmax / r)
    };
}
function randomInInterval(a, b) {
    return a + Math.random() * (b - a);
}
function randint(a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
}
function vec2(x, y) {
    return { x: x, y: y };
}
function clone2(v) {
    return { x: v.x, y: v.y };
}
function magSq2(v) {
    return v.x * v.x + v.y * v.y;
}
function mag2(v) {
    return Math.sqrt(magSq2(v));
}
function normalize2(v) {
    const len = mag2(v);
    return {
        x: v.x / len,
        y: v.y / len
    };
}
function mult2(v, f) {
    return {
        x: v.x * f,
        y: v.y * f
    };
}
function div2(v, f) {
    return {
        x: v.x / f,
        y: v.y / f
    };
}
function add2(u, v) {
    return {
        x: u.x + v.x,
        y: u.y + v.y
    };
}
function sub2(u, v) {
    return {
        x: u.x - v.x,
        y: u.y - v.y
    };
}
function dot2(u, v) {
    return u.x * v.x + u.y * v.y;
}
function rotate2(v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: c * v.x - s * v.y,
        y: s * v.x + c * v.y
    };
}
function det(u, v) {
    return u.x * v.y - u.y * v.x;
}
function vec3(x, y, z) {
    return { x: x, y: y, z: z };
}
function clone3(v) {
    return { x: v.x, y: v.y, z: v.z };
}
function magSq3(v) {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}
function mag3(v) {
    return Math.sqrt(magSq3(v));
}
function normalize3(v) {
    const len = mag3(v);
    return {
        x: v.x / len,
        y: v.y / len,
        z: v.z / len
    };
}
function mult3(v, f) {
    return {
        x: v.x * f,
        y: v.y * f,
        z: v.z * f
    };
}
function div3(v, f) {
    return {
        x: v.x / f,
        y: v.y / f,
        z: v.z / f
    };
}
function add3(u, v) {
    return {
        x: u.x + v.x,
        y: u.y + v.y,
        z: u.z + v.z
    };
}
function sub3(u, v) {
    return {
        x: u.x - v.x,
        y: u.y - v.y,
        z: u.z - v.z
    };
}
function dot3(u, v) {
    return u.x * v.x + u.y * v.y + u.z * v.z;
}
function cross(u, v) {
    return {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x
    };
}
function rotate3(v, axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const v1 = mult3(v, c);
    const v2 = mult3(cross(axis, v), s);
    const v3 = mult3(axis, dot3(axis, v) * (1 - c));
    return add3(add3(v1, v2), v3);
}
