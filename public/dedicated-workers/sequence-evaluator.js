"use strict";
{
    importScripts("libs/common.js", "libs/math.js", "libs/physics.js", "libs/physics-2d.js");
    let system;
    let config;
    let current = null;
    onWorkerInitialize = data => {
        system = data.system;
        config = data.config;
    };
    onWorkerRun = input => {
        current = evaluateInChunks(input);
        sendProgress(0);
    };
    onWorkerContinue = () => {
        if (!current)
            return;
        const { done, value } = current.next();
        if (done)
            sendResult(value);
    };
    onWorkerStop = () => current = null;
    function* evaluateInChunks(sequences) {
        const results = [];
        const { progressStep } = config.workers;
        for (let i = 0; i < sequences.length; i++) {
            results.push(evaluateSequence(sequences[i]));
            if (i % progressStep == 0) {
                sendProgress(i);
                yield;
            }
        }
        return results;
    }
    function evaluateSequence(sequence) {
        const bodies = getSequenceBodies(sequence);
        const attractor = system[bodies[0].orbiting];
        const depDeltaV = hohmannTransferDeltaV(bodies[0], bodies[1]);
        if (bodies.length == 2) {
            const depVel = depDeltaV + bodies[0].circularVel;
            const relativeArrVel = hohmannEncounterRelativeVel(bodies[0], bodies[1], depVel, attractor);
            return Math.abs(depDeltaV) + Math.abs(relativeArrVel);
        }
        const statuses = generateInitialStatuses(bodies[0], depDeltaV);
        const { maxEvalStatuses, radiusSamples } = config.flybySequence;
        let evalCount = 0;
        while (statuses.length > 0) {
            evalCount++;
            if (evalCount > maxEvalStatuses) {
                break;
            }
            const status = statuses.pop();
            const targetBody = bodies[status.target];
            const itsc = calculateNextIntersection(status.pos, status.vel, targetBody, attractor, config);
            if (itsc) {
                const targetBodyVel = getBodyVelocity2D(itsc.pos, targetBody);
                const arrivalVel = getRelativeVelocity2D(itsc.vel, targetBodyVel);
                if (status.target == bodies.length - 1) {
                    return Math.abs(depDeltaV) + mag2(arrivalVel);
                }
                for (let i = radiusSamples - 1; i >= 0; i--) {
                    const radius = lerp(targetBody.radius, targetBody.soi, i / radiusSamples);
                    const exitVels = calculateQuickFlyby(radius, arrivalVel, targetBody);
                    statuses.push({
                        pos: itsc.pos,
                        vel: getGlobalVelocity2D(exitVels.v1, targetBodyVel),
                        target: status.target + 1
                    });
                    statuses.push({
                        pos: itsc.pos,
                        vel: getGlobalVelocity2D(exitVels.v2, targetBodyVel),
                        target: status.target + 1
                    });
                }
            }
        }
    }
    function getSequenceBodies(sequence) {
        const bodies = [];
        for (const id of sequence) {
            bodies.push(system[id]);
        }
        return bodies;
    }
    function generateInitialStatuses(depBody, depDeltaV) {
        const statuses = [];
        const { initVelMaxScale, initVelSamples } = config.flybySequence;
        for (let i = 0; i < initVelSamples; ++i) {
            const scale = (i / initVelSamples) * initVelMaxScale;
            statuses.push({
                pos: { x: depBody.orbit.semiMajorAxis, y: 0 },
                vel: { x: 0, y: depDeltaV * scale + depBody.circularVel },
                target: 1
            });
        }
        return statuses;
    }
}
