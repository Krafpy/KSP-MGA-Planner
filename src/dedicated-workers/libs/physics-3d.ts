function orbitalElementsFromOrbitData(orbit: IOrbit) : OrbitalElements{
    // Calculate main direction vectors
    // with reference direction (1, 0, 0)
    const right = vec3(1, 0, 0), up = vec3(0, 1, 0);
    const ascNodeDir = rotate3(right, up, orbit.ascNodeLongitude);
    const normal = rotate3(up, ascNodeDir, orbit.inclination);
    const periapsisDir = rotate3(ascNodeDir, normal, orbit.argOfPeriapsis);

    return {
        semiMajorAxis:    orbit.semiMajorAxis,
        eccentricity:     orbit.eccentricity,
        periapsiDir:      periapsisDir,
        inclination:      orbit.inclination,
        argOfPeriapsis:   orbit.argOfPeriapsis,
        ascNodeLongitude: orbit.ascNodeLongitude,
        ascNodeDir:       ascNodeDir,
        // @ts-ignore
        orbitalParam:     orbit.orbitalParam
    };
}

function equatorialCircularOrbit(radius: number) : OrbitalElements{
    return {
        eccentricity:     0,
        periapsisDir:     vec3(1, 0, 0),
        semiMajorAxis:    radius,
        inclination:      0,
        argOfPeriapsis:   0,
        ascNodeLongitude: 0,
        ascNodeDir:       vec3(1, 0, 0),
        orbitalParam:     radius
    };
}

/**
 * Calculates the state vectors of an orbiting body at a given date
 * @param body The body to calculate the state of
 * @param date The date (in s)
 * @param mu The standard gravitational parameter of the the attractor body around which `body` is orbiting
 * @returns The state vectors of the body at the specified date
 */
function getBodyStateAtDate(body: IOrbitingBody, date: number, mu: number) {
    const {orbit} = body;

    const n = <number>orbit.meanMotion;
    const M = body.meanAnomaly0 + n * date;
    const nu = solveTrueAnomalyFromMeanAnomaly(orbit.eccentricity, M);

    const orbitElts = orbitalElementsFromOrbitData(orbit);

    return stateFromOrbitElements(orbitElts, mu, nu);
}

/**
 * @param orbit An orbit
 * @param soi The sphere of influence radius of the orbit's attractor body
 * @returns The true anomaly of the point on that orbit leaving the SOI.
 */
function soiExitTrueAnomaly(orbit: OrbitalElements, soi: number){
    const p = orbit.orbitalParam;
    const e = orbit.eccentricity;
    return Math.acos((p/soi - 1) / e);
}

/**
 * @param orbit An orbit
 * @returns The radius of the periapsis of that orbit.
 */
function periapsisRadius(orbit: OrbitalElements){
    return orbit.semiMajorAxis * (1 - orbit.eccentricity);
}

/**
 * Calculates the time of flight between two anomalies on a given orbit.
 * @param orbit The orbit
 * @param attractor The orbit's attractor
 * @param nu1 The start true anomaly
 * @param nu2 The end true anomaly
 * @returns The time of flight from the first to the second anomaly provided.
 */
function tofBetweenAnomalies(orbit: OrbitalElements, attractor: ICelestialBody, nu1: number, nu2: number){
    const mu = attractor.stdGravParam;
    const a = orbit.semiMajorAxis;
    const e = orbit.eccentricity;
    /*let EH1 = eccentricAnomalyFromTrueAnomaly(nu1, e);
    let EH2 = eccentricAnomalyFromTrueAnomaly(nu2, e);*/
    let tof = 0;
    if(e < 1) {
        let E1 = eccentricAnomalyFromTrueAnomaly(nu1, e);
        let E2 = eccentricAnomalyFromTrueAnomaly(nu2, e);
        const invN = Math.sqrt(a*a*a/mu);
        if(E2 < E1) {
            E2 += TWO_PI;
        }
        tof = invN * ( E2 - E1 + e*(Math.sin(E1) - Math.sin(E2)) );
    } else {
        let H1 = eccentricAnomalyFromTrueAnomaly(nu1, e);
        let H2 = eccentricAnomalyFromTrueAnomaly(nu2, e);
        if(H2 < H1) {
            const t = H2;
            H2 = H1;
            H1 = t;
        }
        const invN = Math.sqrt(-a*a*a/mu);
        tof = -invN * ( H2 - H1 + e*(Math.sinh(H1) - Math.sinh(H2)) );
    }
    /*if(tof < 0){
        debug("ERROR");
    }*/
    return tof;
}

/**
 * 
 * @param attractor The attractor body
 * @param radius The orbit radius
 * @returns The velocity for a circular orbit around the specified body at the specified radius.
 */
function circularVelocity(attractor: ICelestialBody, radius: number) {
    return Math.sqrt(attractor.stdGravParam / radius);
}

/**
 * @param attractor The attractor body
 * @param radius The departure radius
 * @returns The minimum velocity required to reach escape the body's gravtational attraction.
 */
function ejectionVelocity(attractor: ICelestialBody, radius: number){
    return Math.SQRT2 * circularVelocity(attractor, radius);
}

/**
 * Calculates the magnitude of the velocity for a given radius on an orbit.
 * @param orbit The orbit
 * @param attractor The attractor body of the orbit
 * @param radius The radius from the attractor (must exist on that orbit)
 * @returns The velocity at the specified radius of the specified orbit
 */
function velocityAtRadius(orbit: OrbitalElements, attractor: ICelestialBody, radius: number){
    return Math.sqrt(attractor.stdGravParam * (2/radius - 1/orbit.semiMajorAxis));
}

/**
 * @param bodyPos The position the body relative to its attractor
 * @param retrograde Whether the direction should be prograde or retrograde to the body's movement
 * @returns The tangent vector pointing prograde or retrograde in the body's velocity direction
 * and the angle of departure from the reference direction
 */
function idealEjectionDirection(bodyPos: Vector3, retrograde: boolean) {
    const tangent = normalize3(vec3(bodyPos.z, 0, -bodyPos.x));
    let nu = Math.acos(bodyPos.x / mag3(bodyPos));
    nu = bodyPos.z >= 0 ? nu : TWO_PI - nu;
    if(retrograde) {
        tangent.x *= -1;
        tangent.z *= -1;
        nu = (nu + Math.PI) % TWO_PI;
    }
    return {tangent, nu};
}

/**
 * Calculates the offset angle of the ejection manoeuvre to perform to get an ejection velocity parallel to
 * The body's movement direction
 * @param perigeeVel The velocity at the periapsis of the orbit
 * @param perigeeRadius The radius of the periapsis
 * @param attractor The attractor body of the orbit
 * @returns The angle needed to have an asymptotic ejection velocity parallel to the body's direction
 */
function hyperbolicEjectionOffsetAngle(perigeeVel: number, perigeeRadius: number, attractor: ICelestialBody){
    const e = perigeeRadius*perigeeVel*perigeeVel/attractor.stdGravParam - 1;
    return Math.PI - Math.acos(-1/e);
}

/**
 * Calculates the orbital elements of an orbit from cartesian state vectors, based on:
 * https://downloads.rene-schwarz.com/download/M002-Cartesian_State_Vectors_to_Keplerian_Orbit_Elements.pdf
 * @param state The orbital state containing the cartesian state vectors, relative to the attractor
 * @param attractor The attractor body of the orbit
 * @returns The corresponding orbital elements.
 */
function stateToOrbitElements(state: {pos: Vector3, vel: Vector3}, attractor: ICelestialBody) : OrbitalElements {
    const mu = attractor.stdGravParam;

    const pos = state.pos;
    const vel = state.vel;
    const r = mag3(pos);
    const v2 = magSq3(vel);
    
    // Momentum
    const h = cross(pos, vel);
    // Eccentricity vector
    let evec = sub3(div3(cross(vel, h), mu), div3(pos, r));
    let e = mag3(evec);
    if(e <= 1e-15) {
        evec = vec3(0, 0, 0);
        e = 0;
    }

    // Vector pointing towards the ascending node
    let nvec = cross(vec3(0, 1, 0), h);
    const n = mag3(nvec);

    // Orbital inclination
    const i = Math.acos(h.y / mag3(h));

    // Longitude of the ascending node
    const t_lan = Math.acos(nvec.x / n);
    let lan = nvec.z <= 0 ? t_lan : TWO_PI - t_lan;

    // Argument of the periapsis
    const t_arg = Math.acos(dot3(nvec, evec) / (e * n));
    let arg = evec.y >= 0 ? t_arg : TWO_PI - t_arg;

    // Semi major axis
    const a = 1 / ( 2/r - v2/mu );
    
    // Calculate the orbital parameter
    const p = a * (1 - e*e);

    // Use alternate orbital elements in special cases
    if(i == 0 && e != 0) {
        // Longitude of perigee
        const t_plong = Math.acos(dot3(vec3(1, 0, 0), evec) / e);
        const plong = evec.z < 0 ? t_plong : TWO_PI - t_plong;
        lan = 0;
        nvec = vec3(1, 0, 0);
        arg = plong;
    } else if(i != 0 && e == 0) {
        arg = 0;
        evec = clone3(nvec);
    } else if(i == 0 && e == 0) {
        lan = 0;
        nvec = vec3(1, 0, 0);
        arg = 0;
        evec = vec3(1, 0, 0);
    }

    return {
        eccentricity:       e,
        periapsisDir:       normalize3(evec),
        semiMajorAxis:      a,
        inclination:        i,
        argOfPeriapsis:     arg,
        ascNodeLongitude:   lan,
        ascNodeDir:         normalize3(nvec),
        orbitalParam:       p
    };
}

/**
 * Calculates the true anomaly of state on an orbit, considering extreme cases with alternate
 * orbital elements described here:
 * https://www.faa.gov/about/office_org/headquarters_offices/avs/offices/aam/cami/library/online_libraries/aerospace_medicine/tutorial/media/III.4.1.4_Describing_Orbits.pdf
 * @param orbitElts The orbital elements describing the orbit
 * @param state A state on that orbit
 * @returns The true anomaly of that state on the specified orbit
 */
function trueAnomalyFromOrbitalState(orbitElts: OrbitalElements, state: {pos: Vector3, vel: Vector3}) { 
    const pos = state.pos;
    const vel = state.vel;
    const r = mag3(pos);

    const e = orbitElts.eccentricity;
    const i = orbitElts.inclination;

    let nu: number;

    if(e != 0) {
        // Elliptic orbit : we directly compute the true anomaly
        const evec = orbitElts.periapsisDir;
        const t_nu = Math.acos(dot3(evec, pos) / r);
        const d = dot3(pos, vel);
        if(e < 1) {
            nu = d >= 0 ? t_nu : TWO_PI - t_nu;
        } else {
            nu = d >= 0 ? t_nu : -t_nu;
        }

    } else if(i != 0) { // && e == 0
        // Circular inclined orbit: the true anomaly is the argument of latitude
        const nvec = orbitElts.ascNodeDir;
        const t_u = Math.acos(dot3(nvec, pos) / r);
        let u: number;
        if(e < 1) {
            u = pos.y >= 0 ? t_u : TWO_PI - t_u;
        } else {
            u = pos.y >= 0 ? t_u : -t_u;
        }
        nu = u;

    } else { // i == 0 && e == 0
        // Circular and equatorial orbit : the true anomaly is the true longitude
        const t_l = Math.acos(pos.x / r);
        let l: number;
        if(e < 1) {
            l = vel.x <= 0 ? t_l : TWO_PI - t_l;
        } else {
            l = vel.x <= 0 ? t_l : -t_l;
        }
        nu = l;
    }

    return nu;
}

function eccentricAnomalyFromTrueAnomaly(nu: number, e: number) {
    if(e < 1) { // Elliptic orbit
        // Eccentric anomaly
        return 2 * Math.atan( Math.tan(nu*0.5) * Math.sqrt((1-e)/(1+e)) );
    } else { // Hyperbolic orbit, the case e = 1 (parabolic orbit) will never be reached
        // Hyperbolic eccentric anomaly
        return 2 * Math.atanh( Math.tan(nu*0.5) * Math.sqrt((e-1)/(e+1)) );
    }
}

function meanAnomalyFromEccentricAnomaly(EH: number, e: number) {
    if(e < 1) { // Elliptic orbit
        return EH - e * Math.sin(EH);
    } else { // Hyperbolic orbit, the case e = 1 (parabolic orbit) will never be reached
        return e * Math.sinh(EH) - EH;
    }
}

/**
 * Calculates the mean anomaly corresponding to the specified true anomaly of an orbit
 * with the specified eccentricity.
 * @param nu The true anomaly
 * @param e The eccentricty of the orbit
 * @returns The corresponding mean anomaly
 */
function meanAnomalyFromTrueAnomaly(nu: number, e: number) {
    if(e < 1) { // Elliptic orbit
        // Eccentric anomaly
        const E = 2 * Math.atan( Math.tan(nu*0.5) * Math.sqrt((1-e)/(1+e)) );
        // Mean anomaly
        const M = E - e * Math.sin(E);
        return M;

    } else { // Hyperbolic orbit, the case e = 1 (parabolic orbit) will never be reached
        // Hyperbolic eccentric anomaly
        const H = 2 * Math.atanh( Math.tan(nu*0.5) * Math.sqrt((e-1)/(e+1)) );
        // Mean anomaly
        const M = e * Math.sinh(H) - H;
        return M;
    }
}

function solveTrueAnomalyFromMeanAnomaly(e: number, M: number){
    // Solving Kepler's equation for eccentric anomaly with Newton's method.
    if(e < 1) {
        const E = newtonRootSolve(
            x => x - e * Math.sin(x) - M,
            x => 1 - e * Math.cos(x),
            M,
            1e-15
        );
        return 2 * Math.atan(Math.sqrt((1 + e)/(1 - e)) * Math.tan(E * 0.5));
    } else {
        const H = newtonRootSolve(
            x => e * Math.sinh(x) - x - M,
            x => e * Math.cosh(x) - 1,
            M,
            1e-15
        );
        return 2 * Math.atan(Math.sqrt((e + 1)/(e - 1)) * Math.tanh(H * 0.5));
    }
}

/**
 * Calculates the state vectors at the specified true anomaly for a given orbit.
 * @param orbit The orbital elements describing the orbit
 * @param mu The attractor's body standard gravitational parameter
 * @param nu The true anomaly at which get the state
 * @returns The state vectors
 */
function stateFromOrbitElements(orbit: OrbitalElements, mu: number, nu: number){
    const a = orbit.semiMajorAxis;
    const e = orbit.eccentricity;
    const p = orbit.orbitalParam;
    
    nu *= -1; // Without this the resulting position is on the opposite side

    const r = p / (1 + e * Math.cos(nu)); // radius of the orbit

    // 2D position with periapsis pointing towards (1, 0, 0) (reference direction)
    let pos = vec3(r * Math.cos(nu), 0, r * Math.sin(nu));
    // the corresponding 2D velocity 
    let vel: Vector3;
    if(e < 1) { // Elliptical orbit
        const v = Math.sqrt(mu * a) / r;
        const E = eccentricAnomalyFromTrueAnomaly(nu, e);
        vel = vec3(v * Math.sin(E), 0, -v * Math.sqrt(1 - e*e) * Math.cos(E));
    } else { // Hyperbolic orbit (the case e = 1, parabolic orbit, will never be reached)
        const v = Math.sqrt(-mu * a) / r;
        const H = eccentricAnomalyFromTrueAnomaly(nu, e);
        vel = vec3(v * Math.sinh(H), 0, -v * Math.sqrt(e*e - 1) * Math.cosh(H));
    }

    // Rotating the plane vectors towards their real 3D position
    const right = vec3(1, 0, 0), up = vec3(0, 1, 0);
    const ascNodeDir = rotate3(right, up, orbit.ascNodeLongitude);

    pos = rotate3(pos, up, orbit.ascNodeLongitude);
    pos = rotate3(pos, up, orbit.argOfPeriapsis);
    pos = rotate3(pos, ascNodeDir, orbit.inclination);

    vel = rotate3(vel, up, orbit.ascNodeLongitude);
    vel = rotate3(vel, up, orbit.argOfPeriapsis);
    vel = rotate3(vel, ascNodeDir, orbit.inclination);

    return {pos, vel};
}

/**
 * Calculates the orbital state reached after the specified time of flight from the
 * starting point defined by the specified initial true anomaly.
 * @param orbit The orbital elements describing the orbit
 * @param nu0 The initial true anomaly
 * @param deltaTime The duration of the flight between the initial point
 * @param mu The attractor body's standard gravitational parameter
 * @returns The orbital state vectors.
 */
function propagateState(orbit: OrbitalElements, nu0: number, deltaTime: number, attractor: ICelestialBody){
    const M0 = meanAnomalyFromTrueAnomaly(nu0, orbit.eccentricity);
    
    const a = Math.abs(orbit.semiMajorAxis);
    const mu = attractor.stdGravParam;
    const n = Math.sqrt(mu / (a*a*a));
    const MNext = M0 + n * deltaTime;

    const nuNext = solveTrueAnomalyFromMeanAnomaly(orbit.eccentricity, MNext);
    return stateFromOrbitElements(orbit, mu, nuNext);
}

function calculateOrbitPeriod(a: number, mu: number){
    return TWO_PI * Math.sqrt(a*a*a/mu);
}

function getHohmannPeriod(body1: IOrbitingBody, body2: IOrbitingBody, attractor: ICelestialBody){
    const orbit1 = body1.orbit;
    const orbit2 = body2.orbit;
    const {stdGravParam} = attractor;
    const a = (orbit1.semiMajorAxis + orbit2.semiMajorAxis) * 0.5;
    const period = calculateOrbitPeriod(a, stdGravParam);
    return period;
}