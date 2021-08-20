function getBodyVelocity2D(pos: Vector2, body: IOrbitingBody) : Vector2 {
    const v = vec2(-pos.y, pos.x);
    const len = mag2(v);
    return {
        x: (v.x / len) * body.circularVel,
        y: (v.y / len) * body.circularVel
    };
}

function getRelativeVelocity2D(globalVel: Vector2, bodyVel: Vector2) {
    return sub2(globalVel, bodyVel);
}

function getGlobalVelocity2D(relativeVel: Vector2, bodyVel: Vector2) {
    return add2(relativeVel, bodyVel);
}

/**
 * @param pos0 The position in space from which deduce orbital elements
 * @param vel0 The velocity in space from which deduce orbital elements
 * @param body The body which orbit is targeted for intersection
 * @param config The configuration data
 * @returns The velocity and positon when intersecting the body's orbit, or undefined if no intersection
 */
function calculateNextIntersection(pos0: Vector2, vel0: Vector2, body: IOrbitingBody, attractor: ICelestialBody) 
: {pos: Vector2, vel: Vector2} | undefined {
    const mu = attractor.stdGravParam;

    // Calculate orbital parameters from initial position and velocity
    const v0 = mag2(vel0);
    const r0 = mag2(pos0);

    // Calculate the eccentricity vector
    const rvFactor = v0*v0 - mu/r0;
    const rv = {x: pos0.x * rvFactor, y: pos0.y * rvFactor};
    const vvScale = -pos0.x * vel0.x - pos0.y * vel0.y;
    const vv = {x: vel0.x * vvScale, y: vel0.y * vvScale};
    const evec = {
        x: (rv.x + vv.x) / mu,
        y: (rv.y + vv.y) / mu
    };

    // Eccentricity
    const e = mag2(evec);
    // Semi major axis
    const a = -mu*r0/(r0*v0*v0-2*mu);
    // Orbital parameter
    const p = a * (1 - e*e);
    
    // Calculate the position and velocity at next intersection with the body's orbit
    const targetRadius = body.orbit.semiMajorAxis
    let cosTrueAnom = (p - targetRadius) / (e * targetRadius);

    if(Math.abs(cosTrueAnom) > 1.0001)
        return;

    cosTrueAnom = clamp(cosTrueAnom, -1, 1);
    let sinTrueAnom = Math.sqrt(1 - cosTrueAnom*cosTrueAnom);
    if(pos0.x*vel0.y - pos0.y*vel0.x > 0)
        sinTrueAnom *= -1;
    
    const velMag = Math.sqrt(mu/p);
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

/**
 * @param rp The perapsis radius to the body
 * @param vin The incoming velocity relative to the body
 * @param body The body on which the flyby happens
 * @returns The two possible exit velocities relative to the body
 */
 function calculateQuickFlyby(rp: number, vin: Vector2, body: IOrbitingBody)
 : {v1: Vector2, v2: Vector2} {
    const v = mag2(vin);
    const a = -body.stdGravParam / v;
    const e = 1 - rp/a;
    const dev = 2 * Math.asin(1/e);

    const c = Math.cos(dev);
    const s = Math.sin(dev);

    return {
        v1: {
            x: c*vin.x - s*vin.y,
            y: s*vin.x + c*vin.y
        }, 
        v2: {
            x: c*vin.x + s*vin.y,
            y: c*vin.y - s*vin.x
        }
    };
}