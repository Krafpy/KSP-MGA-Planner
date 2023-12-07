"use strict";
var Physics3D;
(function (Physics3D) {
    function orbitElementsFromOrbitData(orbit) {
        const right = vec3(1, 0, 0), up = vec3(0, 1, 0);
        const ascNodeDir = rotate3(right, up, orbit.ascNodeLongitude);
        const normal = rotate3(up, ascNodeDir, orbit.inclination);
        const periapsisDir = rotate3(ascNodeDir, normal, orbit.argOfPeriapsis);
        if (orbit.orbitalParam === undefined) {
            throw new Error("Undefined orbital parameter.");
        }
        return {
            semiMajorAxis: orbit.semiMajorAxis,
            eccentricity: orbit.eccentricity,
            periapsisDir: periapsisDir,
            inclination: orbit.inclination,
            argOfPeriapsis: orbit.argOfPeriapsis,
            ascNodeLongitude: orbit.ascNodeLongitude,
            ascNodeDir: ascNodeDir,
            orbitalParam: orbit.orbitalParam
        };
    }
    Physics3D.orbitElementsFromOrbitData = orbitElementsFromOrbitData;
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
    Physics3D.equatorialCircularOrbit = equatorialCircularOrbit;
    function bodyStateAtDate(body, orbit, attractor, date) {
        const n = body.orbit.meanMotion;
        const M = body.meanAnomaly0 + n * (date - body.epoch);
        const nu = trueAnomalyFromMeanAnomaly(orbit.eccentricity, M);
        return orbitElementsToState(orbit, attractor, nu);
    }
    Physics3D.bodyStateAtDate = bodyStateAtDate;
    function circularVelocity(attractor, radius) {
        return Math.sqrt(attractor.stdGravParam / radius);
    }
    Physics3D.circularVelocity = circularVelocity;
    function ejectionVelocity(attractor, radius) {
        return Math.SQRT2 * circularVelocity(attractor, radius);
    }
    Physics3D.ejectionVelocity = ejectionVelocity;
    function periapsisRadius(orbit) {
        return orbit.semiMajorAxis * (1 - orbit.eccentricity);
    }
    Physics3D.periapsisRadius = periapsisRadius;
    function trueAnomalyAtRadius(orbit, radius) {
        const p = orbit.orbitalParam;
        const e = orbit.eccentricity;
        const cosNu = (p / radius - 1) / e;
        if (Math.abs(cosNu) > 1)
            throw new Error("The orbit never reaches that radius.");
        return Math.acos(cosNu);
    }
    Physics3D.trueAnomalyAtRadius = trueAnomalyAtRadius;
    function velocityAtRadius(orbit, attractor, radius) {
        const mu = attractor.stdGravParam;
        const a = orbit.semiMajorAxis;
        const v2 = mu * (2 / radius - 1 / a);
        if (v2 < 0)
            throw new Error("Invalid radius.");
        return Math.sqrt(v2);
    }
    Physics3D.velocityAtRadius = velocityAtRadius;
    function velocityToReachAltitude(body, r0, r) {
        const mu = body.stdGravParam;
        const a = 0.5 * (r0 + r);
        const v2 = mu * (2 / r0 - 1 / a);
        if (v2 < 0)
            throw new Error("Invalid radius.");
        const vej2 = 2 * mu / r0;
        return Math.sqrt(Math.min(vej2, v2));
    }
    Physics3D.velocityToReachAltitude = velocityToReachAltitude;
    function orbitPeriod(attractor, a) {
        return TWO_PI * Math.sqrt(a * a * a / attractor.stdGravParam);
    }
    Physics3D.orbitPeriod = orbitPeriod;
    function specificEnergy(attractor, r, v) {
        return 0.5 * v * v - attractor.stdGravParam / r;
    }
    Physics3D.specificEnergy = specificEnergy;
    function deduceVelocityAtRadius(attractor, r0, v0, r) {
        const se = specificEnergy(attractor, r0, v0);
        return Math.sqrt(2 * (se + attractor.stdGravParam / r));
    }
    Physics3D.deduceVelocityAtRadius = deduceVelocityAtRadius;
    function stateToOrbitElements(state, attractor) {
        const mu = attractor.stdGravParam;
        const pos = state.pos;
        const vel = state.vel;
        const r = mag3(pos);
        const v2 = magSq3(vel);
        const nullEps = 1e-10;
        const h = cross(pos, vel);
        let evec = sub3(div3(cross(vel, h), mu), div3(pos, r));
        let e = mag3(evec);
        if (e <= nullEps) {
            evec = vec3(0, 0, 0);
            e = 0;
        }
        let nvec = cross(vec3(0, 1, 0), h);
        const n = mag3(nvec);
        let i = Math.acos(h.y / mag3(h));
        let inXZPlane = false;
        if (Math.abs(i) < nullEps) {
            i = 0;
            inXZPlane = true;
        }
        else if (Math.abs(i - Math.PI) < nullEps) {
            i = Math.PI;
            inXZPlane = true;
        }
        else if (Math.abs(i + Math.PI) < nullEps) {
            i = -Math.PI;
            inXZPlane = true;
        }
        const cosEps = 1e-5;
        let cos_lan = nvec.x / n;
        if (Math.abs(cos_lan) < 1 + cosEps) {
            cos_lan = clamp(cos_lan, -1, 1);
        }
        const t_lan = Math.acos(cos_lan);
        let lan = nvec.z <= 0 ? t_lan : TWO_PI - t_lan;
        let cos_arg = dot3(nvec, evec) / (e * n);
        if (Math.abs(cos_arg) < 1 + cosEps) {
            cos_arg = clamp(cos_arg, -1, 1);
        }
        const t_arg = Math.acos(cos_arg);
        let arg = evec.y >= 0 ? t_arg : TWO_PI - t_arg;
        const a = 1 / (2 / r - v2 / mu);
        const p = a * (1 - e * e);
        if (inXZPlane && e != 0) {
            const t_plong = Math.acos(dot3(vec3(1, 0, 0), evec) / e);
            const plong = evec.z < 0 ? t_plong : TWO_PI - t_plong;
            lan = 0;
            nvec = vec3(1, 0, 0);
            arg = plong;
        }
        else if (!inXZPlane && e == 0) {
            arg = 0;
            evec = clone3(nvec);
        }
        else if (inXZPlane && e == 0) {
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
    Physics3D.stateToOrbitElements = stateToOrbitElements;
    function orbitElementsToState(orbit, attractor, nu) {
        const mu = attractor.stdGravParam;
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
    Physics3D.orbitElementsToState = orbitElementsToState;
    function trueAnomalyFromOrbitalState(orbit, state) {
        const pos = state.pos;
        const vel = state.vel;
        const r = mag3(pos);
        const e = orbit.eccentricity;
        const i = orbit.inclination;
        let nu;
        if (e != 0) {
            const evec = orbit.periapsisDir;
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
            const nvec = orbit.ascNodeDir;
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
    Physics3D.trueAnomalyFromOrbitalState = trueAnomalyFromOrbitalState;
    function eccentricAnomalyFromTrueAnomaly(nu, e) {
        if (e < 1) {
            return 2 * Math.atan(Math.tan(nu * 0.5) * Math.sqrt((1 - e) / (1 + e)));
        }
        else {
            return 2 * Math.atanh(Math.tan(nu * 0.5) * Math.sqrt((e - 1) / (e + 1)));
        }
    }
    Physics3D.eccentricAnomalyFromTrueAnomaly = eccentricAnomalyFromTrueAnomaly;
    function meanAnomalyFromEccentricAnomaly(EH, e) {
        if (e < 1) {
            return EH - e * Math.sin(EH);
        }
        else {
            return e * Math.sinh(EH) - EH;
        }
    }
    Physics3D.meanAnomalyFromEccentricAnomaly = meanAnomalyFromEccentricAnomaly;
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
    Physics3D.meanAnomalyFromTrueAnomaly = meanAnomalyFromTrueAnomaly;
    function trueAnomalyFromMeanAnomaly(e, M) {
        if (e < 1) {
            const E = newtonRootSolve(x => x - e * Math.sin(x) - M, x => 1 - e * Math.cos(x), M, 1e-15);
            return 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E * 0.5));
        }
        else {
            const H = newtonRootSolve(x => e * Math.sinh(x) - x - M, x => e * Math.cosh(x) - 1, M, 1e-15);
            return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H * 0.5));
        }
    }
    Physics3D.trueAnomalyFromMeanAnomaly = trueAnomalyFromMeanAnomaly;
    function propagateStateFromTrueAnomaly(orbit, attractor, nu0, deltaTime) {
        const M0 = meanAnomalyFromTrueAnomaly(nu0, orbit.eccentricity);
        const a = Math.abs(orbit.semiMajorAxis);
        const mu = attractor.stdGravParam;
        const n = Math.sqrt(mu / (a * a * a));
        const MNext = M0 + n * deltaTime;
        const nuNext = trueAnomalyFromMeanAnomaly(orbit.eccentricity, MNext);
        return orbitElementsToState(orbit, attractor, nuNext);
    }
    Physics3D.propagateStateFromTrueAnomaly = propagateStateFromTrueAnomaly;
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
        if (tof < 0)
            throw new Error("Negative TOF calculated.");
        return tof;
    }
    Physics3D.tofBetweenAnomalies = tofBetweenAnomalies;
})(Physics3D || (Physics3D = {}));
