"use strict";
importScripts("libs/common.js", "libs/math.js", "libs/physics.js", "libs/physics-2d.js");
class SequenceEvaluator extends WorkerEnvironment {
    constructor() {
        super(...arguments);
        this._current = null;
    }
    onWorkerInitialize(data) {
        this._system = data.system;
        this._config = data.config;
    }
    onWorkerRun(input) {
        this._sequences = input;
        const { orbiting } = this._system[this._sequences[0][0]];
        this._attractor = this._system[orbiting];
        this._current = this._evaluateSequenceChunks();
        sendProgress(0);
    }
    onWorkerContinue() {
        if (!this._current)
            return;
        const { done, value } = this._current.next();
        if (done)
            sendResult(value);
    }
    onWorkerStop() {
        this._current = null;
    }
    *_evaluateSequenceChunks() {
        const results = [];
        const { progressStep } = this._config.workers;
        for (let i = 0; i < this._sequences.length; i++) {
            results.push(this._evaluateSequence(this._sequences[i]));
            if (i % progressStep == 0) {
                sendProgress(i);
                yield;
            }
        }
        return results;
    }
    _evaluateSequence(sequence) {
        const bodies = this._bodySequenceOf(sequence);
        const depDeltaV = hohmannTransferDeltaV(bodies[0], bodies[1]);
        if (bodies.length == 2) {
            const depVel = depDeltaV + bodies[0].circularVel;
            const relativeArrVel = hohmannEncounterRelativeVel(bodies[0], bodies[1], depVel, this._attractor);
            return Math.abs(depDeltaV) + Math.abs(relativeArrVel);
        }
        const statuses = this._generateInitialStatuses(bodies[0], depDeltaV);
        const { maxEvalStatuses, radiusSamples } = this._config.flybySequence;
        let evalCount = 0;
        while (statuses.length > 0) {
            evalCount++;
            if (evalCount > maxEvalStatuses) {
                break;
            }
            const status = statuses.pop();
            const targetBody = bodies[status.target];
            const itsc = calculateNextIntersection(status.pos, status.vel, targetBody, this._attractor);
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
    _bodySequenceOf(sequence) {
        const bodies = [];
        for (const id of sequence) {
            bodies.push(this._system[id]);
        }
        return bodies;
    }
    _generateInitialStatuses(depBody, depDeltaV) {
        const statuses = [];
        const { initVelMaxScale, initVelSamples } = this._config.flybySequence;
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
initWorker(SequenceEvaluator);
