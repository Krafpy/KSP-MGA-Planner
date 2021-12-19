import { OrbitingBody } from "../objects/body.js";
import { SolarSystem } from "../objects/system.js";
import { ComputeWorker, WorkerPool } from "../utilities/worker.js";
import { shuffleArray } from "../utilities/array.js";
import { FlybySequence } from "./sequence.js";

export class FlybySequenceGenerator {
    private readonly _workerPool!:      WorkerPool;
    private readonly _sequenceWorker!:  ComputeWorker;

    public totalFeasible: number = 0; // The total number of generated sequences, without further evaluation

    constructor(public readonly system: SolarSystem, public readonly config: Config) {
        // The sequence evaluation worker pool
        this._workerPool = new WorkerPool("dist/dedicated-workers/sequence-evaluator.js", this.config);
        this._workerPool.initialize({system: this.system.data, config: this.config});

        // The worker used to generate the set of sequences
        this._sequenceWorker = new ComputeWorker("dist/dedicated-workers/sequence-generator.js");
        this._sequenceWorker.initialize(this.config);
    }

    /**
     * Cancels the worker pool
     * TODO : isn't responsive enough
     */
    public cancel() {this._workerPool.cancel();}

    /**
     * The current progression returned by the worker pool of the sequences evaluator
     */
    public get progression() {
        return this._workerPool.totalProgress;
    }

    /**
     * Generates a list of possible planetary sequences, ordered according to an estimation
     * of the ideal deltaV required. The number of sequences returned is clamped by maxPropositions in
     * the config.
     * @param params The parameters of the sequences to generate
     * @param onProgress The progress callback function
     * @returns The list of generated sequences
     */
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
            const sequence = new FlybySequence(this.system, feasibleSet[result.seq]);
            sequences.push(sequence);
        }
    
        return sequences;
    }

    /**
     * Returns the list of bodies that can be used in the sequence generation, i.e. the ones whose orbit is between the
     * departure body orbit and the arrival body orbit.
     * @param departureBody The departure body
     * @param params The parameters of the sequences to generate
     * @param toHigherOrbit whether the destination body is on a higher or lower orbit than the departure body
     * @returns The list of bodies that can be used in the sequence generation.
     */
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

    /**
     * Generates the feasible set of sequences, i.e. sequences that respect the constraints
     * of the parameters.
     * @param allowedBodies The list of allowed bodies for the sequence generation
     * @param params The parameters of the sequences
     * @returns The feasible set
     */
    private _generateFeasibleSet(allowedBodies: number[], params: SequenceParameters) {
        return this._sequenceWorker.run<number[][]>({bodies: allowedBodies, params: params});
    }

    /**
     * Evaluates the ideal deltaV of each sequences according to their physical feasibility in a simplified 2D
     * physical model.
     * @param sequences The list of feasible sequences
     * @param onProgress A progress callback function
     * @returns The cost of eachs sequence
     */
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
}