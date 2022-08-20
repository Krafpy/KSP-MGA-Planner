import { EvolutionPlot } from "../editor/plot.js";
import { SolarSystem } from "../objects/system.js";
import { mergeArrayChunks } from "../utilities/array.js";
import { WorkerManager, WorkerPool } from "../utilities/worker.js";
import { FlybySequence } from "./sequence.js";

export class TrajectorySolver {
    private _workerPool: WorkerPool;

    public popSize: number = 0;

    private _cancelled:    boolean = false;
    private _running:      boolean = false;
    private _population:   Agent[] = [];
    private _fitnesses:    number[] = [];
    private _deltaVs:      number[] = [];
    private _numChunks:    number = 0;
    private _chunkIndices: number[] = [];

    public bestSteps:  TrajectoryStep[] = [];
    public bestDeltaV: number = 0;

    constructor(public readonly system: SolarSystem, public readonly config: Config, public readonly plot: EvolutionPlot) {
        this._workerPool = WorkerManager.getPool("trajectory-optimizer");
        this._workerPool.initialize({system: this.system.data, config: this.config});
    }

    /**
     * Adds delta-V data to the evolution plot.
     * @param iteration The iteration number of the new plot sample
     */
    private _updatePlot(iteration: number){
        let mean = 0;
        for(const dv of this._deltaVs)
            mean += dv;
        mean /= this.popSize;
        const best = this.bestDeltaV;
        this.plot.addIterationData(iteration, mean, best);
    }

    /**
     * Cancels trajectory search.
     */
    public cancel(){
        if(this._running) this._cancelled = true;
    }

    /**
     * Runs the trajectory search given the settings and flyby sequence.
     * @param sequence The sequence of flyby bodies
     * @param settings The user settings for the trajectory
     */
    public async searchOptimalTrajectory(sequence: FlybySequence, settings: TrajectoryUserSettings){
        this._running = true;
        
        this.plot.clearPlot()

        this._calculatePopulationSize(sequence);
        this._calculatePopulationChunks();

        await this._passSettingsData(sequence, settings);
        await this._createStartPopulation();
        this._updatePlot(0);

        const {maxGenerations} = this.config.trajectorySearch;
        for(let i = 0; i < maxGenerations; i++) {
            if(this._cancelled){
                this._cancelled = false;
                this._running = false;
                throw new Error("TRAJECTORY FINDER CANCELLED");
            }
            await this._generateNextPopulation();
            this._updatePlot(1 + i);
        }
        
        this._running = false;
    }

    /**
     * Passes settings data to the trajectory search workers.
     * @param sequence The flyby sequence
     * @param settings The user settings for the trajectory
     * @returns A promise to wait for the data to be sent
     */
    private async _passSettingsData(sequence: FlybySequence, settings: TrajectoryUserSettings){
        return this._workerPool.passData({sequence: sequence.ids, settings});
    }

    /**
     * Computes the amount of parallel workers to be used and defines the beginning
     * and end of each chunk of the evolved population.
     */
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

    /**
     * Creates the start population chunks in the workers, and merges them.
     */
    private async _createStartPopulation(){
        const inputs = [];
        for(let i = 0; i < this._numChunks; i++) {
            const start = this._chunkIndices[i * 2];
            const end = this._chunkIndices[i * 2 + 1];
            inputs.push({
                start:      true,
                chunkStart: start,
                chunkEnd:   end
            });
        }
        const results = await this._workerPool.runPool<GenerationResult>(inputs);
        this._mergeResultsChunks(results);
    }

    /**
     * Runs the trajectory search workers for one evolution iteration, generating
     * a new child population.
     */
    private async _generateNextPopulation(){
        const inputs = [];
        for(let i = 0; i < this._numChunks; i++) {
            inputs[i] = {
                population: this._population,
                fitnesses:  this._fitnesses,
            };
        }
        const results = await this._workerPool.runPool<GenerationResult>(inputs);
        this._mergeResultsChunks(results);
    }

    /**
     * Computes the size of the population for the given sequence length.
     * @param sequence The flyby sequence
     */
    private _calculatePopulationSize(sequence: FlybySequence){
        const {popSizeDimScale} = this.config.trajectorySearch;
        this.popSize = popSizeDimScale * sequence.length;
    }

    /**
     * Merges the chunked results from the workers (population, fitnesses, delta-V...)
     * and merges them.
     * @param results Chunked results of the last generation returned by the workers.
     */
    private _mergeResultsChunks(results: GenerationResult[]){
        const popChunks: Agent[][]  = [];
        const fitChunks: number[][] = [];
        const dVsChunks: number[][] = [];

        let bestDeltaV = Infinity;
        let bestSteps: TrajectoryStep[] = [];

        for(let i = 0; i < this._numChunks; i++) {
            const chunk = results[i];
            popChunks.push(chunk.popChunk);
            fitChunks.push(chunk.fitChunk);
            dVsChunks.push(chunk.dVsChunk);

            if(chunk.bestDeltaV < bestDeltaV) {
                bestSteps  = chunk.bestSteps;
                bestDeltaV = chunk.bestDeltaV;
            }
        }
        this._population = mergeArrayChunks(popChunks);
        this._fitnesses  = mergeArrayChunks(fitChunks);
        this._deltaVs    = mergeArrayChunks(dVsChunks);

        this.bestSteps  = bestSteps;
        this.bestDeltaV = bestDeltaV;
    }
}