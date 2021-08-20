"use strict";
function getBodyVelocity2D(pos, body) {
    const v = vec2(-pos.y, pos.x);
    const len = mag2(v);
    return {
        x: (v.x / len) * body.circularVel,
        y: (v.y / len) * body.circularVel
    };
}
function getRelativeVelocity2D(globalVel, bodyVel) {
    return sub2(globalVel, bodyVel);
}
function getGlobalVelocity2D(relativeVel, bodyVel) {
    return add2(relativeVel, bodyVel);
}
function calculateNextIntersection(pos0, vel0, body, attractor) {
    const mu = attractor.stdGravParam;
    const v0 = mag2(vel0);
    const r0 = mag2(pos0);
    const rvFactor = v0 * v0 - mu / r0;
    const rv = { x: pos0.x * rvFactor, y: pos0.y * rvFactor };
    const vvScale = -pos0.x * vel0.x - pos0.y * vel0.y;
    const vv = { x: vel0.x * vvScale, y: vel0.y * vvScale };
    const evec = {
        x: (rv.x + vv.x) / mu,
        y: (rv.y + vv.y) / mu
    };
    const e = mag2(evec);
    const a = -mu * r0 / (r0 * v0 * v0 - 2 * mu);
    const p = a * (1 - e * e);
    const targetRadius = body.orbit.semiMajorAxis;
    let cosTrueAnom = (p - targetRadius) / (e * targetRadius);
    if (Math.abs(cosTrueAnom) > 1.0001)
        return;
    cosTrueAnom = clamp(cosTrueAnom, -1, 1);
    let sinTrueAnom = Math.sqrt(1 - cosTrueAnom * cosTrueAnom);
    if (pos0.x * vel0.y - pos0.y * vel0.x > 0)
        sinTrueAnom *= -1;
    const velMag = Math.sqrt(mu / p);
    return {
        pos: {
            x: cosTrueAnom * targetRadius,
            y: sinTrueAnom * targetRadius
        },
        vel: {
            x: -sinTrueAnom * velMag,
            y: (e + cosTrueAnom) * velMag
        }
    };
}
function calculateQuickFlyby(rp, vin, body) {
    const v = mag2(vin);
    const a = -body.stdGravParam / v;
    const e = 1 - rp / a;
    const dev = 2 * Math.asin(1 / e);
    const c = Math.cos(dev);
    const s = Math.sin(dev);
    return {
        v1: {
            x: c * vin.x - s * vin.y,
            y: s * vin.x + c * vin.y
        },
        v2: {
            x: c * vin.x + s * vin.y,
            y: c * vin.y - s * vin.x
        }
    };
}
