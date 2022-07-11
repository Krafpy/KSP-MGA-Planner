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
        this._fitnesses = [];
        this._deltaVs = [];
        this._numChunks = 0;
        this._chunkIndices = [];
        this.bestSteps = [];
        this.bestDeltaV = 0;
        this._workerPool = new WorkerPool("dist/dedicated-workers/trajectory-optimizer.js", this.config);
        this._workerPool.initialize({ system: this.system.data, config: this.config });
    }
    _updatePlot(iteration) {
        let mean = 0;
        for (const dv of this._deltaVs)
            mean += dv;
        mean /= this.popSize;
        const best = this.bestDeltaV;
        this.plot.addIterationData(iteration, mean, best);
    }
    cancel() {
        if (this._running)
            this._cancelled = true;
    }
    async searchOptimalTrajectory(sequence, startDateMin, startDateMax, depAltitude, destAltitude) {
        this._running = true;
        this.plot.clearPlot();
        this._calculatePopulationSize(sequence);
        this._calculatePopulationChunks();
        await this._passSettingsData(sequence.ids, startDateMin, startDateMax, depAltitude, destAltitude);
        await this._createStartPopulation();
        this._updatePlot(0);
        const { maxGenerations } = this.config.trajectorySearch;
        for (let i = 0; i < maxGenerations; i++) {
            if (this._cancelled) {
                this._cancelled = false;
                this._running = false;
                throw new Error("TRAJECTORY FINDER CANCELLED");
            }
            await this._generateNextPopulation();
            this._updatePlot(1 + i);
        }
        this._running = false;
    }
    async _passSettingsData(sequence, startDateMin, startDateMax, depAltitude, destAltitude) {
        return this._workerPool.passData({
            depAltitude, destAltitude, sequence, startDateMin, startDateMax
        });
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
    async _createStartPopulation() {
        const inputs = [];
        for (let i = 0; i < this._numChunks; i++) {
            const start = this._chunkIndices[i * 2];
            const end = this._chunkIndices[i * 2 + 1];
            inputs.push({
                start: true,
                chunkStart: start,
                chunkEnd: end
            });
        }
        const results = await this._workerPool.runPool(inputs);
        this._mergeResultsChunks(results);
    }
    async _generateNextPopulation() {
        const inputs = [];
        for (let i = 0; i < this._numChunks; i++) {
            inputs[i] = {
                population: this._population,
                fitnesses: this._fitnesses,
            };
        }
        const results = await this._workerPool.runPool(inputs);
        this._mergeResultsChunks(results);
    }
    _calculatePopulationSize(sequence) {
        const { popSizeDimScale } = this.config.trajectorySearch;
        this.popSize = popSizeDimScale * sequence.length;
    }
    _mergeResultsChunks(results) {
        const popChunks = [];
        const fitChunks = [];
        const dVsChunks = [];
        let bestDeltaV = Infinity;
        let bestSteps = [];
        for (let i = 0; i < this._numChunks; i++) {
            const chunk = results[i];
            popChunks.push(chunk.popChunk);
            fitChunks.push(chunk.fitChunk);
            dVsChunks.push(chunk.dVsChunk);
            if (chunk.bestDeltaV < bestDeltaV) {
                bestSteps = chunk.bestSteps;
                bestDeltaV = chunk.bestDeltaV;
            }
        }
        this._population = mergeArrayChunks(popChunks);
        this._fitnesses = mergeArrayChunks(fitChunks);
        this._deltaVs = mergeArrayChunks(dVsChunks);
        this.bestSteps = bestSteps;
        this.bestDeltaV = bestDeltaV;
    }
}
