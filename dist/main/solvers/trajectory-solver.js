import { mergeArrayChunks } from "../utilities/array.js";
import { WorkerPool } from "../utilities/worker.js";
export class TrajectorySolver {
    constructor(system, config, plot) {
        this.system = system;
        this.config = config;
        this.plot = plot;
        this.popSize = 0;
        this._cancelled = false;
        this._running = false;
        this._population = [];
        this._deltaVs = [];
        this._numChunks = 0;
        this._chunkIndices = [];
        this.bestTrajectorySteps = [];
        this.bestDeltaV = 0;
        this._workerPool = new WorkerPool("dist/dedicated-workers/trajectory-optimizer.js", this.config);
        this._workerPool.initialize({ system: this.system.data, config: this.config });
    }
    _initPlot() {
        this.plot.clearPlot();
    }
    _updatePlot(iteration) {
        const { best, mean } = this._bestMeanDeltaV;
        this.plot.addIterationData(iteration, mean, best);
    }
    cancel() {
        if (this._running)
            this._cancelled = true;
    }
    _checkCancellation() {
        if (this._cancelled) {
            this._cancelled = false;
            this._running = false;
            throw new Error("TRAJECTORY FINDER CANCELLED");
        }
    }
    async searchOptimalTrajectory(sequence, startDateMin, startDateMax, depAltitude) {
        this._running = true;
        this._initPlot();
        this._calculatePopulationSize(sequence);
        this._calculatePopulationChunks();
        await this._passSettingsData(sequence.ids, startDateMin, startDateMax, depAltitude);
        await this._createStartPopulation();
        this._updatePlot(0);
        this._checkCancellation();
        const { maxGenerations } = this.config.trajectorySearch;
        for (let i = 0; i < maxGenerations; i++) {
            await this._generateNextPopulation();
            this._updatePlot(1 + i);
            this._checkCancellation();
        }
        this._running = false;
    }
    async _passSettingsData(sequence, startDateMin, startDateMax, depAltitude) {
        return this._workerPool.passData({ depAltitude, sequence, startDateMin, startDateMax });
    }
    async _createStartPopulation() {
        const inputs = this._firstGenerationInputs();
        const results = await this._workerPool.runPool(inputs);
        this._mergeResultsChunks(results);
    }
    _calculatePopulationChunks() {
        const { splitLimit } = this.config.trajectorySearch;
        const numChunks = this._workerPool.optimizeUsedWorkersCount(this.popSize, splitLimit);
        const chunkSize = Math.floor(this.popSize / numChunks);
        const chunkIndices = [0, chunkSize - 1];
        for (let i = 2; i < numChunks * 2; i += 2) {
            const start = chunkIndices[i - 1] + 1;
            const end = start + chunkSize;
            chunkIndices.push(start, end);
        }
        chunkIndices[numChunks * 2 - 1] = this.popSize - 1;
        this._numChunks = numChunks;
        this._chunkIndices = chunkIndices;
    }
    _calculatePopulationSize(sequence) {
        const { popSizeDimScale } = this.config.trajectorySearch;
        this.popSize = popSizeDimScale * (4 * (sequence.length - 1) + 2);
    }
    async _generateNextPopulation() {
        const inputs = this._nextGenerationInputs();
        const results = await this._workerPool.runPool(inputs);
        this._mergeResultsChunks(results);
    }
    _mergeResultsChunks(results) {
        const popChunks = [];
        const dVChunks = [];
        let bestDeltaV = Infinity;
        let bestSteps = [];
        for (let i = 0; i < this._numChunks; i++) {
            const chunk = results[i];
            popChunks.push(chunk.popChunk);
            dVChunks.push(chunk.fitChunk);
            if (chunk.bestDeltaV < bestDeltaV) {
                bestDeltaV = chunk.bestDeltaV;
                bestSteps = chunk.bestSteps;
            }
        }
        this._population = mergeArrayChunks(popChunks);
        this._deltaVs = mergeArrayChunks(dVChunks);
        this.bestTrajectorySteps = bestSteps;
        this.bestDeltaV = bestDeltaV;
    }
    _firstGenerationInputs() {
        const inputs = [];
        for (let i = 0; i < this._numChunks; i++) {
            const { start, end } = this._chunkStartEnd(i);
            inputs.push({
                start: true,
                chunkStart: start,
                chunkEnd: end
            });
        }
        return inputs;
    }
    _nextGenerationInputs() {
        const inputs = [];
        for (let i = 0; i < this._numChunks; i++) {
            const { start, end } = this._chunkStartEnd(i);
            inputs[i] = {
                population: this._population,
                deltaVs: this._deltaVs,
                chunkStart: start,
                chunkEnd: end
            };
        }
        return inputs;
    }
    _chunkStartEnd(index) {
        return {
            start: this._chunkIndices[index * 2],
            end: this._chunkIndices[index * 2 + 1]
        };
    }
    get _bestMeanDeltaV() {
        let mean = 0;
        for (const dv of this._deltaVs)
            mean += dv;
        mean /= this.popSize;
        return {
            mean: mean,
            best: this.bestDeltaV
        };
    }
}
