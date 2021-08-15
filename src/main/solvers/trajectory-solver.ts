import { EvolutionPlot } from "../editor/plot.js";
import { SolarSystem } from "../objects/system.js";
import { mergeArrayChunks } from "../utilities/array.js";
import { WorkerPool } from "../utilities/worker.js";
import { FlybySequence } from "../objects/sequence.js";

export class TrajectorySolver {
    private readonly _workerPool!: WorkerPool;

    public popSize: number = 0;

    private _cancelled:    boolean = false;
    private _running:      boolean = false;
    private _population:   Agent[] = [];
    private _deltaVs:      number[] = [];
    private _numChunks:    number = 0;
    private _chunkIndices: number[] = [];

    public bestTrajectorySteps: TrajectoryStep[] = [];
    public bestDeltaV: number = 0;

    constructor(public readonly system: SolarSystem, public readonly config: Config, public readonly plot: EvolutionPlot) {
        this._workerPool = new WorkerPool("dedicated-workers/trajectory-optimizer.js", this.config);
        this._workerPool.initialize({system: this.system.data, config: this.config});
    }
    
    private _initPlot(){
        this.plot.clearPlot();
    }

    private _updatePlot(iteration: number){
        const {best, mean} = this._bestMeanDeltaV;
        this.plot.addIterationData(iteration, mean, best);
    }

    public cancel(){
        if(this._running) this._cancelled = true;
    }

    private _checkCancellation(){
        if(this._cancelled){
            this._cancelled = false;
            this._running = false;
            throw "TRAJECTORY FINDER CANCELLED";
        }
    }

    public async searchOptimalTrajectory(sequence: FlybySequence, startDateMin: number, startDateMax: number, depAltitude: number){
        this._running = true;

        this._initPlot();

        this._calculatePopulationSize(sequence);
        this._calculatePopulationChunks();

        await this._passSettingsData(sequence.ids, startDateMin, startDateMax, depAltitude);
        
        await this._createStartPopulation();
        this._updatePlot(0);
        this._checkCancellation();

        const {maxGenerations} = this.config.trajectorySearch;
        for(let i = 0; i < maxGenerations; i++) {
            await this._generateNextPopulation();
            this._updatePlot(1 + i);
            this._checkCancellation();
        }

        this._running = false;
    }

    private async _passSettingsData(sequence: number[], startDateMin: number, startDateMax: number, depAltitude: number){
        return this._workerPool.passData({depAltitude, sequence, startDateMin, startDateMax});
    }

    private async _createStartPopulation(){
        const inputs = this._firstGenerationInputs();
        const results = await this._workerPool.runPool<GenerationResult>(inputs);
        this._mergeResultsChunks(results);
    }

    private _calculatePopulationChunks(){
        const {splitLimit} = this.config.trajectorySearch;
        const numChunks = this._workerPool.optimizeUsedWorkersCount(this.popSize, splitLimit);
        const chunkSize = Math.floor(this.popSize / numChunks);

        const chunkIndices: number[] = [0, chunkSize - 1];

        for (let i = 2; i < numChunks * 2; i += 2) {
            const start = chunkIndices[i - 1] + 1;
            const end = start + chunkSize;
            chunkIndices.push(start, end);
        }
        chunkIndices[numChunks * 2 - 1] = this.popSize - 1;

        this._numChunks    = numChunks;
        this._chunkIndices = chunkIndices;
    }

    private _calculatePopulationSize(sequence: FlybySequence){
        const {popSizeDimScale} = this.config.trajectorySearch;
        this.popSize = popSizeDimScale * (4 * (sequence.length - 1) + 2);
    }

    private async _generateNextPopulation(){
        const inputs = this._nextGenerationInputs();
        const results = await this._workerPool.runPool<GenerationResult>(inputs);
        this._mergeResultsChunks(results);
    }

    private _mergeResultsChunks(results: GenerationResult[]){
        const popChunks: Agent[][] = [];
        const dVChunks: number[][] = [];
        let bestDeltaV = Infinity;
        let bestSteps: TrajectoryStep[] = [];
        for(let i = 0; i < this._numChunks; i++) {
            const chunk = results[i];
            popChunks.push(chunk.popChunk);
            dVChunks.push(chunk.fitChunk);
            if(chunk.bestDeltaV < bestDeltaV) {
                bestDeltaV = chunk.bestDeltaV;
                bestSteps = chunk.bestSteps;
            }
        }
        this._population = mergeArrayChunks(popChunks);
        this._deltaVs = mergeArrayChunks(dVChunks);
        this.bestTrajectorySteps = bestSteps;
        this.bestDeltaV = bestDeltaV;
    }

    private _firstGenerationInputs() {
        const inputs = [];
        for(let i = 0; i < this._numChunks; i++) {
            const {start, end} = this._chunkStartEnd(i);
            inputs.push({
                start:      true,
                chunkStart: start,
                chunkEnd:   end
            });
        }
        return inputs;
    }

    private _nextGenerationInputs() {
        const inputs = [];
        for(let i = 0; i < this._numChunks; i++) {
            const {start, end} = this._chunkStartEnd(i);
            inputs[i] = {
                population: this._population,
                deltaVs:    this._deltaVs,
                chunkStart: start,
                chunkEnd:   end
            };
        }
        return inputs;
    }

    private _chunkStartEnd(index: number){
        return {
            start: this._chunkIndices[index * 2],
            end:   this._chunkIndices[index * 2 + 1]
        };
    }

    private get _bestMeanDeltaV() {
        let mean = 0;
        for(const dv of this._deltaVs)
            mean += dv;
        mean /= this.popSize;
        return {
            mean: mean,
            best: this.bestDeltaV
        };
    }
}