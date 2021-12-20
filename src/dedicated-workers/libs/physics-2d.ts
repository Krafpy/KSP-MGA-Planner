/**
 * Implements functions used for 2D orbits calculations.
 */
namespace Physics2D
{
    /**
     * Computes the 2D orbital elements from 2D state vectors.
     * @param attractor The attractor body.
     * @param state The state vectors.
     * @returns The orbital elements of the corresponding orbit
     */
    export function stateToOrbitElements(attractor: ICelestialBody, state: OrbitalState2D) : OrbitalElements2D {
        const mu = attractor.stdGravParam;

        const {vel, pos} = state;
        // Calculate orbital parameters from initial position and velocity
        const v0 = mag2(vel);
        const r0 = mag2(pos);

        // Calculate the eccentricity vector
        const rvFactor = v0*v0 - mu/r0;
        const rv = {x: pos.x * rvFactor, y: pos.y * rvFactor};
        const vvScale = -pos.x * vel.x - pos.y * vel.y;
        const vv = {x: vel.x * vvScale, y: vel.y * vvScale};
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
        // Periapsis radius and direction
        const rp = a*(1 - e);
        const pvec = mult2(div2(evec, e), rp);

        // Check if orbit is clockwise or counter-clockwise
        const clk = det(pos, vel) < 0;

        return {
            eccentricity: e,
            periapsisVec: pvec,
            semiMajorAxis: a,
            orbitalParam: p,
            clockwise: clk
        };
    }

    /**
     * Compute the state vectors for the provided orbit at the specified true anomaly.
     * @param attractor The attractor body
     * @param elements The orbital elements of the orbit
     * @param trueAnomaly The true anomaly at which compute the state vectors
     * @returns The state vectors
     */
    /*export function orbitElementsToState(attractor: ICelestialBody, orbitElts: OrbitalElements2D, trueAnomaly: number) : OrbitalState2D {
        const mu = attractor.stdGravParam;

        const e = orbitElts.eccentricity;
        const p = orbitElts.orbitalParam;
        const pdir = orbitElts.periapsisDir;
        
        const c = Math.cos(trueAnomaly);
        const s = Math.sin(trueAnomaly);

        // Calculate the state vectors, with periapsis on the x axis
        const vmag = Math.sqrt(mu/p);
        const rmag = p / (1 + e*c);
        const vdir = orbitElts.clockwise ? -1 : 1;
        const vel = {
            x: -vmag * s * vdir,
            y: vmag * (e + c) * vdir
        };
        const pos = {
            x: rmag * c,
            y: rmag * s
        };

        // Calculate the angle of the peripasis direction relative to the x axis direction
        const pangle = Math.atan2(pdir.y,pdir.x);

        return {
            pos: rotate2(pos, pangle),
            vel: rotate2(vel, pangle)
        };
    }*/

    /**
     * Calculates the two possible exit state with deviated velocities after a flyby. The flyby is considered
     * as an instantaneous event. The two returned velocities represent the deviated
     * velocities when flying by the body behind and in front of it.
     * @param body The body which is flew by
     * @param enterState The state vectors of the ship relative to the attractor of the body as it enters the SOI.
     * @param rp The periapsis of the hyperbolic flyby trajectory
     * @returns The two deviated velocities, relative to the body's attractor
     */
    export function computeFlybyExitVelocities(body: IOrbitingBody, enterState: OrbitalState2D, rp: number): 
    {state1: OrbitalState2D, state2: OrbitalState2D} {
        const mu = body.stdGravParam;

        // Compute the body's velocity at the intersection position.
        // The radius of the circular orbit of the body is equal
        // to the semi major axis of its real orbit.
        const pos = enterState.pos;
        const radius = body.orbit.semiMajorAxis;
        const bodyVel = {
            x: (-pos.y / radius) * body.circularVel,
            y: (pos.x / radius) * body.circularVel
        };
        
        const vin = sub2(enterState.vel, bodyVel); // local incoming velocity
        const v = mag2(vin);
        // parameters of the flyby orbit, in the body's SOI
        const a = -mu / v;
        const e = 1 - rp/a;

        if(e < 1) {
            throw new Error("Invalid smaller than 1 eccentricity in flyby.");
        }

        const dev = 2 * Math.asin(1/e); // deviation angle, relative the body

        const c = Math.cos(dev);
        const s = Math.sin(dev);

        // two opposite rotations using single sin and cos calculation
        const v1local =  {
            x: c*vin.x - s*vin.y,
            y: s*vin.x + c*vin.y
        };
        const v2local =  {
            x: c*vin.x + s*vin.y,
            y: c*vin.y - s*vin.x
        };

        return {
            state1: {pos: pos, vel: add2(v1local, bodyVel)},
            state2: {pos: pos, vel: add2(v2local, bodyVel)}
        };
    }

    /**
     * Compute the next intersection point (with its velocity) with the supposed circular orbit
     * of a body, knowing initial orbital state vectors.
     * @param attractor The attractor's body
     * @param state The ship state
     * @param target The target body orbit we want to intersect
     * @returns The intersection state, if it exists, undefined otherwise
     */
    export function computeNextBodyOrbitIntersection(attractor: ICelestialBody, state: OrbitalState2D, target: IOrbitingBody) : 
    OrbitalState2D | undefined {
        const orbitElts = stateToOrbitElements(attractor, state);
        const e = orbitElts.eccentricity;
        const p = orbitElts.orbitalParam;
        const pvec = orbitElts.periapsisVec;

        const pos0 = state.pos;
        const vel0 = state.vel;

        // Calculate the position and velocity at next intersection with the body's orbit
        // The body's orbit is supposed circular, with a radius equal to the semi major
        // axis of the real orbit

        const tgRadius = target.orbit.semiMajorAxis;
        let cosNu = (p - tgRadius) / (e * tgRadius);

        // No intersection possible
        if(Math.abs(cosNu) > 1)
            return;
            
        //cosTrueAnom = clamp(cosTrueAnom, -1, 1);
        let sinNu = Math.sqrt(1 - cosNu*cosNu);
        if(det(pos0, vel0) > 0)
            sinNu *= -1;
        if(tgRadius > mag2(pos0))
            sinNu *= -1;

        const vmag = Math.sqrt(attractor.stdGravParam/p);
        const vdir = orbitElts.clockwise ? -1 : 1;
        const pos = {
            x: cosNu * tgRadius, 
            y: sinNu * tgRadius
        };
        const vel = {
            x: -sinNu * vmag * vdir, 
            y: (e + cosNu) * vmag * vdir
        };
        
        const pangle = Math.atan2(pvec.y,pvec.x);
        
        return {
            pos: rotate2(pos, pangle),
            vel: rotate2(vel, pangle)
        };
    }

    /**
     * Computes the required delta V to enter the elliptical orbit of a Hohmann transfer
     * going from r1 to r2
     * @param attractor The attractor body
     * @param r1 The departure circular orbit radius
     * @param r2 The target orbit radius
     * @returns The required delta V
     */
    export function hohmannToEllipseDeltaV(attractor: ICelestialBody, r1: number, r2: number) {
        const mu = attractor.stdGravParam;
        return Math.sqrt(mu/r1) * (Math.sqrt(2*r2/(r1+r2)) - 1);
    }

    /**
     * Computes the required delta V to enter the circular orbit of radius r2 after the elliptic
     * transfer orbit.
     * @param attractor The attractor body
     * @param r1 The departure circular orbit radius
     * @param r2 The target orbit radius
     * @returns The required delta V
     */
    export function hohmannCircularDeltaV(attractor: ICelestialBody, r1: number, r2: number){
        const mu = attractor.stdGravParam;
        return Math.sqrt(mu/r2) * (1 - Math.sqrt(2*r1/(r1+r2)));
    }

    /**
     * Computes the velocity of a vessel relative to a body when entering its SOI.
     * The position stored in `state` is supposed to lay on the orbit of the body considered.
     * @param state The orbital state of the vessel when entered the body SOI
     * @param body The body whose SOI the vessel is entering
     * @returns The relative velocity
     */
    export function relativeVelocityToBody(state: OrbitalState2D, body: IOrbitingBody) {
        // Compute the body's velocity at the intersection position.
        // The radius of the circular orbit of the body is equal
        // to the semi major axis of its real orbit.
        const radius = body.orbit.semiMajorAxis;
        const bodyVel = {
            x: (-state.pos.y / radius) * body.circularVel,
            y: (state.pos.x / radius) * body.circularVel
        };

        return sub2(state.vel, bodyVel);
    }
}