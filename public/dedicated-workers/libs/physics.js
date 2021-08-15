"use strict";
function hohmannTransferDeltaV(depBody, arrBody) {
    const r1 = depBody.orbit.semiMajorAxis;
    const r2 = arrBody.orbit.semiMajorAxis;
    const depBodyVel = depBody.circularVel;
    const deltaV = depBodyVel * (Math.sqrt(2 * r2 / (r1 + r2)) - 1);
    return deltaV;
}
function hohmannInjectionDeltaV(depBody, arrBody, parkingOrbitRadius) {
    const depMu = depBody.stdGravParam;
    const dvHohmann = hohmannTransferDeltaV(depBody, arrBody);
    const depOrbitVel = circularVelocity(depBody, parkingOrbitRadius);
    const ejectVel = Math.sqrt(dvHohmann ** 2 + 2 * depMu / parkingOrbitRadius);
    return ejectVel - depOrbitVel;
}
function hohmannEncounterRelativeVel(depBody, arrBody, depVel, attractor) {
    const arrBodyVel = arrBody.circularVel;
    const mu = attractor.stdGravParam;
    const r1 = depBody.orbit.semiMajorAxis;
    const r2 = arrBody.orbit.semiMajorAxis;
    const encounterVel = Math.sqrt(mu * (2 / r2 - 2 / r1 + (depVel ** 2) / mu));
    const relativeArrVel = encounterVel - arrBodyVel;
    return relativeArrVel;
}
function getHohmannPeriod(body1, body2, attractor) {
    const orbit1 = body1.orbit;
    const orbit2 = body2.orbit;
    const { stdGravParam } = attractor;
    const a = (orbit1.semiMajorAxis + orbit2.semiMajorAxis) * 0.5;
    const period = calculateOrbitPeriod(a, stdGravParam);
    return period;
}
function calculateOrbitPeriod(a, mu) {
    return TWO_PI * Math.sqrt(a * a * a / mu);
}
