"use strict";
var Physics2D;
(function (Physics2D) {
    function stateToOrbitElements(attractor, state) {
        const mu = attractor.stdGravParam;
        const { vel, pos } = state;
        const v0 = mag2(vel);
        const r0 = mag2(pos);
        const rvFactor = v0 * v0 - mu / r0;
        const rv = { x: pos.x * rvFactor, y: pos.y * rvFactor };
        const vvScale = -pos.x * vel.x - pos.y * vel.y;
        const vv = { x: vel.x * vvScale, y: vel.y * vvScale };
        const evec = {
            x: (rv.x + vv.x) / mu,
            y: (rv.y + vv.y) / mu
        };
        const e = mag2(evec);
        const a = -mu * r0 / (r0 * v0 * v0 - 2 * mu);
        const p = a * (1 - e * e);
        const rp = a * (1 - e);
        const pdir = mult2(div2(evec, e), rp);
        const clk = det(pos, vel) < 0;
        return {
            eccentricity: e,
            periapsisDir: pdir,
            semiMajorAxis: a,
            orbitalParam: p,
            clockwise: clk
        };
    }
    Physics2D.stateToOrbitElements = stateToOrbitElements;
    function computeFlybyExitVelocities(body, enterState, rp) {
        const mu = body.stdGravParam;
        const pos = enterState.pos;
        const radius = body.orbit.semiMajorAxis;
        const bodyVel = {
            x: (-pos.y / radius) * body.circularVel,
            y: (pos.x / radius) * body.circularVel
        };
        const vin = sub2(enterState.vel, bodyVel);
        const v = mag2(vin);
        const a = -mu / v;
        const e = 1 - rp / a;
        if (e < 1) {
            throw new Error("Invalid smaller than 1 eccentricity in flyby.");
        }
        const dev = 2 * Math.asin(1 / e);
        const c = Math.cos(dev);
        const s = Math.sin(dev);
        const v1local = {
            x: c * vin.x - s * vin.y,
            y: s * vin.x + c * vin.y
        };
        const v2local = {
            x: c * vin.x + s * vin.y,
            y: c * vin.y - s * vin.x
        };
        return {
            state1: { pos: pos, vel: add2(v1local, bodyVel) },
            state2: { pos: pos, vel: add2(v2local, bodyVel) }
        };
    }
    Physics2D.computeFlybyExitVelocities = computeFlybyExitVelocities;
    function computeNextBodyOrbitIntersection(attractor, state, target) {
        const orbitElts = stateToOrbitElements(attractor, state);
        const e = orbitElts.eccentricity;
        const p = orbitElts.orbitalParam;
        const pdir = orbitElts.periapsisDir;
        const pos0 = state.pos;
        const vel0 = state.vel;
        const tgRadius = target.orbit.semiMajorAxis;
        let cosNu = (p - tgRadius) / (e * tgRadius);
        if (Math.abs(cosNu) > 1)
            return;
        let sinNu = Math.sqrt(1 - cosNu * cosNu);
        if (det(pos0, vel0) > 0)
            sinNu *= -1;
        if (tgRadius > mag2(pos0))
            sinNu *= -1;
        const vmag = Math.sqrt(attractor.stdGravParam / p);
        const vdir = orbitElts.clockwise ? -1 : 1;
        const pos = {
            x: cosNu * tgRadius,
            y: sinNu * tgRadius
        };
        const vel = {
            x: -sinNu * vmag * vdir,
            y: (e + cosNu) * vmag * vdir
        };
        const pangle = Math.atan2(pdir.y, pdir.x);
        return {
            pos: rotate2(pos, pangle),
            vel: rotate2(vel, pangle)
        };
    }
    Physics2D.computeNextBodyOrbitIntersection = computeNextBodyOrbitIntersection;
    function hohmannToEllipseDeltaV(attractor, r1, r2) {
        const mu = attractor.stdGravParam;
        return Math.sqrt(mu / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1);
    }
    Physics2D.hohmannToEllipseDeltaV = hohmannToEllipseDeltaV;
    function hohmannCircularDeltaV(attractor, r1, r2) {
        const mu = attractor.stdGravParam;
        return Math.sqrt(mu / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
    }
    Physics2D.hohmannCircularDeltaV = hohmannCircularDeltaV;
    function relativeVelocityToBody(state, body) {
        const radius = body.orbit.semiMajorAxis;
        const bodyVel = {
            x: (-state.pos.y / radius) * body.circularVel,
            y: (state.pos.x / radius) * body.circularVel
        };
        return sub2(state.vel, bodyVel);
    }
    Physics2D.relativeVelocityToBody = relativeVelocityToBody;
})(Physics2D || (Physics2D = {}));
