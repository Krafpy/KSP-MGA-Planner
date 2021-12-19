"use strict";
function orbitalElementsFromOrbitData(orbit) {
    const right = vec3(1, 0, 0), up = vec3(0, 1, 0);
    const ascNodeDir = rotate3(right, up, orbit.ascNodeLongitude);
    const normal = rotate3(up, ascNodeDir, orbit.inclination);
    const periapsisDir = rotate3(ascNodeDir, normal, orbit.argOfPeriapsis);
    return {
        semiMajorAxis: orbit.semiMajorAxis,
        eccentricity: orbit.eccentricity,
        periapsiDir: periapsisDir,
        inclination: orbit.inclination,
        argOfPeriapsis: orbit.argOfPeriapsis,
        ascNodeLongitude: orbit.ascNodeLongitude,
        ascNodeDir: ascNodeDir,
        orbitalParam: orbit.orbitalParam
    };
}
function equatorialCircularOrbit(radius) {
    return {
        eccentricity: 0,
        periapsisDir: vec3(1, 0, 0),
        semiMajorAxis: radius,
        inclination: 0,
        argOfPeriapsis: 0,
        ascNodeLongitude: 0,
        ascNodeDir: vec3(1, 0, 0),
        orbitalParam: radius
    };
}
function getBodyStateAtDate(body, date, mu) {
    const { orbit } = body;
    const n = orbit.meanMotion;
    const M = body.meanAnomaly0 + n * date;
    const nu = solveTrueAnomalyFromMeanAnomaly(orbit.eccentricity, M);
    const orbitElts = orbitalElementsFromOrbitData(orbit);
    return stateFromOrbitElements(orbitElts, mu, nu);
}
function soiExitTrueAnomaly(orbit, soi) {
    const p = orbit.orbitalParam;
    const e = orbit.eccentricity;
    return Math.acos((p / soi - 1) / e);
}
function periapsisRadius(orbit) {
    return orbit.semiMajorAxis * (1 - orbit.eccentricity);
}
function tofBetweenAnomalies(orbit, attractor, nu1, nu2) {
    const mu = attractor.stdGravParam;
    const a = orbit.semiMajorAxis;
    const e = orbit.eccentricity;
    let tof = 0;
    if (e < 1) {
        let E1 = eccentricAnomalyFromTrueAnomaly(nu1, e);
        let E2 = eccentricAnomalyFromTrueAnomaly(nu2, e);
        const invN = Math.sqrt(a * a * a / mu);
        if (E2 < E1) {
            E2 += TWO_PI;
        }
        tof = invN * (E2 - E1 + e * (Math.sin(E1) - Math.sin(E2)));
    }
    else {
        let H1 = eccentricAnomalyFromTrueAnomaly(nu1, e);
        let H2 = eccentricAnomalyFromTrueAnomaly(nu2, e);
        if (H2 < H1) {
            const t = H2;
            H2 = H1;
            H1 = t;
        }
        const invN = Math.sqrt(-a * a * a / mu);
        tof = -invN * (H2 - H1 + e * (Math.sinh(H1) - Math.sinh(H2)));
    }
    return tof;
}
function circularVelocity(attractor, radius) {
    return Math.sqrt(attractor.stdGravParam / radius);
}
function ejectionVelocity(attractor, radius) {
    return Math.SQRT2 * circularVelocity(attractor, radius);
}
function velocityAtRadius(orbit, attractor, radius) {
    return Math.sqrt(attractor.stdGravParam * (2 / radius - 1 / orbit.semiMajorAxis));
}
function idealEjectionDirection(bodyPos, retrograde) {
    const tangent = normalize3(vec3(bodyPos.z, 0, -bodyPos.x));
    let nu = Math.acos(bodyPos.x / mag3(bodyPos));
    nu = bodyPos.z >= 0 ? nu : TWO_PI - nu;
    if (retrograde) {
        tangent.x *= -1;
        tangent.z *= -1;
        nu = (nu + Math.PI) % TWO_PI;
    }
    return { tangent, nu };
}
function hyperbolicEjectionOffsetAngle(perigeeVel, perigeeRadius, attractor) {
    const e = perigeeRadius * perigeeVel * perigeeVel / attractor.stdGravParam - 1;
    return Math.PI - Math.acos(-1 / e);
}
function stateToOrbitElements(state, attractor) {
    const mu = attractor.stdGravParam;
    const pos = state.pos;
    const vel = state.vel;
    const r = mag3(pos);
    const v2 = magSq3(vel);
    const h = cross(pos, vel);
    let evec = sub3(div3(cross(vel, h), mu), div3(pos, r));
    let e = mag3(evec);
    if (e <= 1e-15) {
        evec = vec3(0, 0, 0);
        e = 0;
    }
    let nvec = cross(vec3(0, 1, 0), h);
    const n = mag3(nvec);
    const i = Math.acos(h.y / mag3(h));
    const t_lan = Math.acos(nvec.x / n);
    let lan = nvec.z <= 0 ? t_lan : TWO_PI - t_lan;
    const t_arg = Math.acos(dot3(nvec, evec) / (e * n));
    let arg = evec.y >= 0 ? t_arg : TWO_PI - t_arg;
    const a = 1 / (2 / r - v2 / mu);
    const p = a * (1 - e * e);
    if (i == 0 && e != 0) {
        const t_plong = Math.acos(dot3(vec3(1, 0, 0), evec) / e);
        const plong = evec.z < 0 ? t_plong : TWO_PI - t_plong;
        lan = 0;
        nvec = vec3(1, 0, 0);
        arg = plong;
    }
    else if (i != 0 && e == 0) {
        arg = 0;
        evec = clone3(nvec);
    }
    else if (i == 0 && e == 0) {
        lan = 0;
        nvec = vec3(1, 0, 0);
        arg = 0;
        evec = vec3(1, 0, 0);
    }
    return {
        eccentricity: e,
        periapsisDir: normalize3(evec),
        semiMajorAxis: a,
        inclination: i,
        argOfPeriapsis: arg,
        ascNodeLongitude: lan,
        ascNodeDir: normalize3(nvec),
        orbitalParam: p
    };
}
function trueAnomalyFromOrbitalState(orbitElts, state) {
    const pos = state.pos;
    const vel = state.vel;
    const r = mag3(pos);
    const e = orbitElts.eccentricity;
    const i = orbitElts.inclination;
    let nu;
    if (e != 0) {
        const evec = orbitElts.periapsisDir;
        const t_nu = Math.acos(dot3(evec, pos) / r);
        const d = dot3(pos, vel);
        if (e < 1) {
            nu = d >= 0 ? t_nu : TWO_PI - t_nu;
        }
        else {
            nu = d >= 0 ? t_nu : -t_nu;
        }
    }
    else if (i != 0) {
        const nvec = orbitElts.ascNodeDir;
        const t_u = Math.acos(dot3(nvec, pos) / r);
        let u;
        if (e < 1) {
            u = pos.y >= 0 ? t_u : TWO_PI - t_u;
        }
        else {
            u = pos.y >= 0 ? t_u : -t_u;
        }
        nu = u;
    }
    else {
        const t_l = Math.acos(pos.x / r);
        let l;
        if (e < 1) {
            l = vel.x <= 0 ? t_l : TWO_PI - t_l;
        }
        else {
            l = vel.x <= 0 ? t_l : -t_l;
        }
        nu = l;
    }
    return nu;
}
function eccentricAnomalyFromTrueAnomaly(nu, e) {
    if (e < 1) {
        return 2 * Math.atan(Math.tan(nu * 0.5) * Math.sqrt((1 - e) / (1 + e)));
    }
    else {
        return 2 * Math.atanh(Math.tan(nu * 0.5) * Math.sqrt((e - 1) / (e + 1)));
    }
}
function meanAnomalyFromEccentricAnomaly(EH, e) {
    if (e < 1) {
        return EH - e * Math.sin(EH);
    }
    else {
        return e * Math.sinh(EH) - EH;
    }
}
function meanAnomalyFromTrueAnomaly(nu, e) {
    if (e < 1) {
        const E = 2 * Math.atan(Math.tan(nu * 0.5) * Math.sqrt((1 - e) / (1 + e)));
        const M = E - e * Math.sin(E);
        return M;
    }
    else {
        const H = 2 * Math.atanh(Math.tan(nu * 0.5) * Math.sqrt((e - 1) / (e + 1)));
        const M = e * Math.sinh(H) - H;
        return M;
    }
}
function solveTrueAnomalyFromMeanAnomaly(e, M) {
    if (e < 1) {
        const E = newtonRootSolve(x => x - e * Math.sin(x) - M, x => 1 - e * Math.cos(x), M, 1e-15);
        return 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E * 0.5));
    }
    else {
        const H = newtonRootSolve(x => e * Math.sinh(x) - x - M, x => e * Math.cosh(x) - 1, M, 1e-15);
        return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H * 0.5));
    }
}
function stateFromOrbitElements(orbit, mu, nu) {
    const a = orbit.semiMajorAxis;
    const e = orbit.eccentricity;
    const p = orbit.orbitalParam;
    nu *= -1;
    const r = p / (1 + e * Math.cos(nu));
    let pos = vec3(r * Math.cos(nu), 0, r * Math.sin(nu));
    let vel;
    if (e < 1) {
        const v = Math.sqrt(mu * a) / r;
        const E = eccentricAnomalyFromTrueAnomaly(nu, e);
        vel = vec3(v * Math.sin(E), 0, -v * Math.sqrt(1 - e * e) * Math.cos(E));
    }
    else {
        const v = Math.sqrt(-mu * a) / r;
        const H = eccentricAnomalyFromTrueAnomaly(nu, e);
        vel = vec3(v * Math.sinh(H), 0, -v * Math.sqrt(e * e - 1) * Math.cosh(H));
    }
    const right = vec3(1, 0, 0), up = vec3(0, 1, 0);
    const ascNodeDir = rotate3(right, up, orbit.ascNodeLongitude);
    pos = rotate3(pos, up, orbit.ascNodeLongitude);
    pos = rotate3(pos, up, orbit.argOfPeriapsis);
    pos = rotate3(pos, ascNodeDir, orbit.inclination);
    vel = rotate3(vel, up, orbit.ascNodeLongitude);
    vel = rotate3(vel, up, orbit.argOfPeriapsis);
    vel = rotate3(vel, ascNodeDir, orbit.inclination);
    return { pos, vel };
}
function propagateState(orbit, nu0, deltaTime, attractor) {
    const M0 = meanAnomalyFromTrueAnomaly(nu0, orbit.eccentricity);
    const a = Math.abs(orbit.semiMajorAxis);
    const mu = attractor.stdGravParam;
    const n = Math.sqrt(mu / (a * a * a));
    const MNext = M0 + n * deltaTime;
    const nuNext = solveTrueAnomalyFromMeanAnomaly(orbit.eccentricity, MNext);
    return stateFromOrbitElements(orbit, mu, nuNext);
}
function calculateOrbitPeriod(a, mu) {
    return TWO_PI * Math.sqrt(a * a * a / mu);
}
function getHohmannPeriod(body1, body2, attractor) {
    const orbit1 = body1.orbit;
    const orbit2 = body2.orbit;
    const { stdGravParam } = attractor;
    const a = (orbit1.semiMajorAxis + orbit2.semiMajorAxis) * 0.5;
    const period = calculateOrbitPeriod(a, stdGravParam);
    return period;
}
