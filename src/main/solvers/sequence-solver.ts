import { OrbitingBody } from "../objects/body.js";
import { SolarSystem } from "../objects/system.js";
import { ComputeWorker, WorkerPool } from "../utilities/worker.js";
import { shuffleArray } from "../utilities/array.js";
import { FlybySequence } from "./sequence.js";

export class FlybySequenceGenerator {
    private readonly _workerPool!:      WorkerPool;
    private readonly _sequenceWorker!:  ComputeWorker;

    public totalFeasible: number = 0;

    constructor(public readonly system: SolarSystem, public readonly config: Config) {
        this._workerPool = new WorkerPool("dist/dedicated-workers/sequence-evaluator.js", this.config);
        this._workerPool.initialize({system: this.system.data, config: this.config});

        this._sequenceWorker = new ComputeWorker("dist/dedicated-workers/sequence-generator.js");
        this._sequenceWorker.initialize(this.config);
    }

    public cancel() {
        this._workerPool.cancel();
    }

    public async generateFlybySequences(params: SequenceParameters, onProgress?: (resultsCount?: number) => void){
        const toHigherOrbit = params.destinationId > params.departureId;
        const departureBody = this.system.bodyFromId(params.departureId) as OrbitingBody;
        const allowedBodies = this._getAllowedBodies(departureBody, params, toHigherOrbit);
    
        const feasibleSet = await this._generateFeasibleSet(allowedBodies, params);
        this.totalFeasible = feasibleSet.length;

        const evaluations = await this._evaluateSequences(feasibleSet, onProgress);
        evaluations.sort((a, b) => a.cost - b.cost);

        const {maxPropositions} = this.config.flybySequence;
        const sequences: FlybySequence[] = [];
        for(let i = 0; i < Math.min(maxPropositions, evaluations.length); i++){
            const result = evaluations[i];
            const sequence = new FlybySequence(this.system, feasibleSet[result.seq], result.cost);
            sequences.push(sequence);
        }
    
        return sequences;
    }

    private _getAllowedBodies(departureBody: OrbitingBody, params: SequenceParameters, toHigherOrbit: boolean){
        // We make use of the fact that bodies id's are sorted according to 
        // their radius to their attractor to filter useless bodies
        const allowedBodies: number[] = [];
        for(const body of departureBody.attractor.orbiters){
            if((toHigherOrbit && body.id <= params.destinationId) || 
              (!toHigherOrbit && body.id >= params.destinationId)
            ) {
                allowedBodies.push(body.id);
            }
        }
        return allowedBodies;
    }

    private _generateFeasibleSet(allowedBodies: number[], params: SequenceParameters) {
        return this._sequenceWorker.run<number[][]>({bodies: allowedBodies, params: params});
    }

    private async _evaluateSequences(sequences: number[][], onProgress?: (resultsCount?: number) => void){
        shuffleArray(sequences);
        const {splitLimit} = this.config.flybySequence;
        const costs = await this._workerPool.runPoolChunked<number>(sequences, splitLimit, onProgress);

        const evaluations: {seq: number, cost: number}[] = [];
        for(let i = 0; i < sequences.length; i++){
            if(costs[i] != undefined){
                evaluations.push({seq: i, cost: costs[i]});
            }
        }

        return evaluations;
    }

    public get progression() {
        return this._workerPool.totalProgress;
    }
}