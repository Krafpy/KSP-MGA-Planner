import { ComputeWorker, WorkerPool } from "../utilities/worker.js";
import { shuffleArray } from "../utilities/array.js";
import { FlybySequence } from "../objects/sequence.js";
export class FlybySequenceGenerator {
    constructor(system, config) {
        this.system = system;
        this.config = config;
        this.totalFeasible = 0;
        this._workerPool = new WorkerPool("dedicated-workers/sequence-evaluator.js", this.config);
        this._workerPool.initialize({ system: this.system.data, config: this.config });
        this._sequenceWorker = new ComputeWorker("dedicated-workers/sequence-generator.js");
        this._sequenceWorker.initialize(this.config);
    }
    cancel() {
        this._workerPool.cancel();
    }
    async generateFlybySequences(params, onProgress) {
        const toHigherOrbit = params.destinationId > params.departureId;
        const departureBody = this.system.bodyFromId(params.departureId);
        const allowedBodies = this._getAllowedBodies(departureBody, params, toHigherOrbit);
        const feasibleSet = await this._generateFeasibleSet(allowedBodies, params);
        this.totalFeasible = feasibleSet.length;
        const evaluations = await this._evaluateSequences(feasibleSet, onProgress);
        evaluations.sort((a, b) => a.cost - b.cost);
        const { maxPropositions } = this.config.flybySequence;
        const sequences = [];
        for (let i = 0; i < Math.min(maxPropositions, evaluations.length); i++) {
            const result = evaluations[i];
            const sequence = new FlybySequence(this.system, feasibleSet[result.seq], result.cost);
            sequences.push(sequence);
        }
        return sequences;
    }
    _getAllowedBodies(departureBody, params, toHigherOrbit) {
        const allowedBodies = [];
        for (const body of departureBody.attractor.orbiters) {
            if ((toHigherOrbit && body.id <= params.destinationId) ||
                (!toHigherOrbit && body.id >= params.destinationId)) {
                allowedBodies.push(body.id);
            }
        }
        return allowedBodies;
    }
    _generateFeasibleSet(allowedBodies, params) {
        return this._sequenceWorker.run({ bodies: allowedBodies, params: params });
    }
    async _evaluateSequences(sequences, onProgress) {
        shuffleArray(sequences);
        const { splitLimit } = this.config.flybySequence;
        const costs = await this._workerPool.runPoolChunked(sequences, splitLimit, onProgress);
        const evaluations = [];
        for (let i = 0; i < sequences.length; i++) {
            if (costs[i] != undefined) {
                evaluations.push({ seq: i, cost: costs[i] });
            }
        }
        return evaluations;
    }
    get progression() {
        return this._workerPool.totalProgress;
    }
}
