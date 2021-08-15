import { mergeArrayChunks } from "../utilities/array.js";
import { WorkerPool } from "../utilities/worker.js";
export class TrajectorySolver {
    constructor(system, config, plot) {
        this.system = system;
        this.config = config;
        this.plot = plot;
        this.popSize = 0;
        this.dim = 0;
        this._cancelled = false;
        this._running = false;
        this._population = [];
        this._deltaVs = [];
        this._numChunks = 0;
        this._chunkIndices = [];
        this._workerPool = new WorkerPool("dedicated-workers/trajectory-optimizer.js", this.config);
        this._workerPool.initialize({ system: this.system.data, config: this.config });
    }
    _initPlot() {
        this.plot.clearPlot();
    }
    _updatePlot(iteration) {
        const { best, mean } = this._getBestMeanDeltaV;
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
            throw "TRAJECTORY FINDER CANCELLED";
        }
    }
    async searchOptimalTrajectory(sequence, startDateMin, startDateMax) {
        this._running = true;
        this._initPlot();
        this._calculatePopulationSizes(sequence);
        this._calculatePopulationChunks();
        await this._createStartPopulation(sequence, startDateMin, startDateMax);
        return;
        this._updatePlot(0);
        this._checkCancellation();
        for (let i = 0; i < 50; i++) {
            await this._generateNextPopulation();
            this._updatePlot(1 + i);
            this._checkCancellation();
        }
        this._running = false;
    }
    async _createStartPopulation(sequence, startDateMin, startDateMax) {
        const agentSettings = {
            startDateMin: startDateMin,
            startDateMax: startDateMax,
            dim: this.dim
        };
        const inputs = this._firstGenerationInputs(sequence, agentSettings);
        const results = await this._workerPool.runPool(inputs);
        console.log(results);
        return;
        const { population, deltaVs } = this._mergeResultsChunks(results);
        this._population = population;
        this._deltaVs = deltaVs;
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
    _calculatePopulationSizes(sequence) {
        const swingBys = sequence.length - 2;
        this.dim = 4 * swingBys + 6;
        this.popSize = 10 * this.dim;
    }
    async _generateNextPopulation() {
        const inputs = this._nextGenerationInputs();
        const results = await this._workerPool.runPool(inputs);
        const { population, deltaVs } = this._mergeResultsChunks(results);
        this._population = population;
        this._deltaVs = deltaVs;
    }
    _mergeResultsChunks(results) {
        const popChunks = [];
        const dVChunks = [];
        for (let i = 0; i < this._numChunks; i++) {
            popChunks.push(results[i].popChunk);
            dVChunks.push(results[i].fitChunk);
        }
        return {
            population: mergeArrayChunks(popChunks),
            deltaVs: mergeArrayChunks(dVChunks)
        };
    }
    _firstGenerationInputs(sequence, agentSettings) {
        const inputs = [];
        for (let i = 0; i < this._numChunks; i++) {
            const { start, end } = this._chunkStartEnd(i);
            inputs.push({
                start: true,
                chunkStart: start,
                chunkEnd: end,
                sequence: sequence.ids,
                agentSettings: agentSettings
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
    get _getBestMeanDeltaV() {
        let mean = 0;
        let best = Infinity;
        for (const dv of this._deltaVs) {
            mean += dv;
            best = Math.min(best, dv);
        }
        mean /= this.popSize;
        return {
            mean: mean,
            best: best
        };
    }
}
