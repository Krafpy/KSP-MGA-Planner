/**
 * Returns the deltaV required to get the elliptic Hohmann transfer orbit between
 * the two bodies' orbits, considering perfect circular orbits. The vessel is supposed to orbit on the
 * departure body's orbit at its orbital speed.
 * @param depBody the departure body
 * @param arrBody the arrival body
 * @returns the required deltaV, in m/s
 */
function hohmannTransferDeltaV(depBody: IOrbitingBody, arrBody: IOrbitingBody) {
    const r1 = depBody.orbit.semiMajorAxis;
    const r2 = arrBody.orbit.semiMajorAxis;
    const depBodyVel = depBody.circularVel;
    const deltaV = depBodyVel * ( Math.sqrt(2*r2/(r1+r2)) - 1 );
    return deltaV;
}

function hohmannInjectionDeltaV(depBody: IOrbitingBody, arrBody: IOrbitingBody, parkingOrbitRadius: number){
    const depMu = depBody.stdGravParam;
    const dvHohmann = hohmannTransferDeltaV(depBody, arrBody);
    const depOrbitVel = circularVelocity(depBody, parkingOrbitRadius);
    const ejectVel = Math.sqrt(dvHohmann**2 + 2*depMu/parkingOrbitRadius);
    return ejectVel - depOrbitVel
}

/**
 * Returns the relative velocity to the arrival body considering a direct hohmann transfer between circular
 * orbits.
 * @param depBody the departure body
 * @param arrBody the arrival body
 * @param depVel the departure velocity of the vessel at the start of the transfer, relative to the attractor
 * @param attractor the attractor of the orbits
 * @returns the relative velocity to the arrival body
 */
function hohmannEncounterRelativeVel(depBody: IOrbitingBody, arrBody: IOrbitingBody, depVel: number, attractor: ICelestialBody) {
    const arrBodyVel = arrBody.circularVel;

    const mu = attractor.stdGravParam;
    const r1 = depBody.orbit.semiMajorAxis;
    const r2 = arrBody.orbit.semiMajorAxis;

    const encounterVel = Math.sqrt(
        mu * (2/r2 - 2/r1 + (depVel**2)/mu)
    );
    const relativeArrVel = encounterVel - arrBodyVel;
    return relativeArrVel;
}

/**
 * Returns the orbital period of the elliptic Hohmann transfer orbit between the two bodies
 * @param body1 the departure body
 * @param body2 the arrival body
 * @param attractor the attractor body
 * @returns the orbital period.
 */
function getHohmannPeriod(body1: IOrbitingBody, body2: IOrbitingBody, attractor: ICelestialBody){
    const orbit1 = body1.orbit;
    const orbit2 = body2.orbit;
    const {stdGravParam} = attractor;
    const a = (orbit1.semiMajorAxis + orbit2.semiMajorAxis) * 0.5;
    const period = calculateOrbitPeriod(a, stdGravParam);
    return period;
}

function calculateOrbitPeriod(a: number, mu: number){
    return TWO_PI * Math.sqrt(a*a*a/mu);
}