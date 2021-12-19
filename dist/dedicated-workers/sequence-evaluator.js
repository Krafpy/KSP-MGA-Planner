"use strict";
importScripts("libs/common.js", "libs/math.js", "libs/physics-2d.js");
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
    onWorkerStop() { this._current = null; }
    *_evaluateSequenceChunks() {
        const results = [];
        const { progressStep } = this._config.workers;
        for (let i = 0; i < this._sequences.length; i++) {
            const cost = this._evaluateSequence(this._sequences[i]);
            results.push(cost);
            if (i % progressStep == 0) {
                sendProgress(i);
                yield;
            }
        }
        return results;
    }
    _directHohmannTransferCost(body1, body2) {
        const attr = this._attractor;
        const r1 = body1.orbit.semiMajorAxis;
        const r2 = body2.orbit.semiMajorAxis;
        const depDV = Physics2D.hohmannToEllipseDeltaV(attr, r1, r2);
        const arrDV = Physics2D.hohmannCircularDeltaV(attr, r1, r2);
        return Math.abs(depDV) + Math.abs(arrDV);
    }
    _generateInitialNodes(depBody, nextBody) {
        const nodes = [];
        const attr = this._attractor;
        const r1 = depBody.orbit.semiMajorAxis;
        const r2 = nextBody.orbit.semiMajorAxis;
        const hohDV = Physics2D.hohmannToEllipseDeltaV(attr, r1, r2);
        const { initVelMaxScale, initVelSamples } = this._config.flybySequence;
        for (let i = initVelSamples; i > 0; i--) {
            const scale = lerp(1, initVelMaxScale, i / initVelSamples);
            const dv = hohDV * scale;
            nodes.push({
                state: {
                    pos: { x: depBody.orbit.semiMajorAxis, y: 0 },
                    vel: { x: 0, y: dv + depBody.circularVel }
                },
                next: 1,
                depDV: dv
            });
        }
        return nodes;
    }
    _evaluateSequence(sequence) {
        const bodies = [];
        for (const id of sequence) {
            bodies.push(this._system[id]);
        }
        const attr = this._attractor;
        if (bodies.length == 2)
            return this._directHohmannTransferCost(bodies[0], bodies[1]);
        const nodes = this._generateInitialNodes(bodies[0], bodies[1]);
        const { maxEvalStatuses, radiusSamples } = this._config.flybySequence;
        let evalCount = 0;
        while (nodes.length > 0) {
            if (++evalCount > maxEvalStatuses)
                break;
            const node = nodes.pop();
            const { state } = node;
            const tgBody = bodies[node.next];
            const itscState = Physics2D.computeNextBodyOrbitIntersection(attr, state, tgBody);
            if (itscState) {
                if (node.next == bodies.length - 1) {
                    const arrVel = Physics2D.relativeVelocity(itscState, tgBody);
                    return Math.abs(node.depDV) + mag2(arrVel);
                }
                for (let i = radiusSamples - 1; i >= 0; i--) {
                    const rp = lerp(tgBody.radius, tgBody.soi, i / radiusSamples);
                    const { state1, state2 } = Physics2D.computeFlybyExitVelocities(tgBody, itscState, rp);
                    const next = node.next + 1;
                    const depDV = node.depDV;
                    nodes.push({ state: state1, next, depDV });
                    nodes.push({ state: state2, next, depDV });
                }
            }
        }
    }
}
initWorker(SequenceEvaluator);
