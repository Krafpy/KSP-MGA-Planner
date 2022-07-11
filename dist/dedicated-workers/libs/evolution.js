"use strict";
class ChunkedEvolver {
    constructor(chunkStart, chunkEnd, settings) {
        this.chunkStart = chunkStart;
        this.chunkEnd = chunkEnd;
        this.chunkSize = chunkEnd - chunkStart + 1;
        this.agentDim = settings.agentDim;
        this.fitness = settings.fitness;
        this.cr = settings.cr;
        this.f = settings.f;
    }
    createRandomAgent() {
        const agent = Array(this.agentDim);
        this.randomizeAgent(agent);
        return agent;
    }
    randomizeAgent(agent) {
        for (let i = 0; i < this.agentDim; i++) {
            agent[i] = Math.random();
        }
    }
    createRandomPopulationChunk() {
        const popChunk = [];
        for (let i = 0; i < this.chunkSize; i++) {
            popChunk.push(this.createRandomAgent());
        }
        return popChunk;
    }
    evaluateChunkFitness(popChunk) {
        const fitChunk = Array(popChunk.length);
        for (let i = 0; i < popChunk.length; i++) {
            fitChunk[i] = this.fitness(popChunk[i]);
        }
        return fitChunk;
    }
    evolvePopulationChunk(population, fitnesses) {
        const dim = this.agentDim;
        const updated = [];
        const nextPopChunk = Array(this.chunkSize);
        const nextFitChunk = Array(this.chunkSize);
        for (let j = this.chunkStart; j <= this.chunkEnd; j++) {
            const x = population[j];
            const fx = fitnesses[j];
            const [a, b, c] = this._pick3(population, j);
            const ri = randint(0, dim - 1);
            const y = Array(dim).fill(0);
            for (let i = 0; i < dim; i++) {
                if (Math.random() < this.cr || i == ri) {
                    y[i] = a[i] + this.f * (b[i] - c[i]);
                }
                else {
                    y[i] = x[i];
                }
                y[i] = clamp(y[i], 0, 1);
            }
            const fy = this.fitness(y);
            const index = j - this.chunkStart;
            if (fy < fx) {
                nextPopChunk[index] = y;
                nextFitChunk[index] = fy;
                updated.push(index);
            }
            else {
                nextPopChunk[index] = x;
                nextFitChunk[index] = fx;
            }
        }
        return {
            popChunk: nextPopChunk,
            fitChunk: nextFitChunk,
            updated: updated
        };
    }
    _pick3(population, parentIndex) {
        const swap = (arr, i, j) => {
            const t = arr[j];
            arr[j] = arr[i];
            arr[i] = t;
        };
        swap(population, parentIndex, 0);
        const picked = [null, null, null];
        const pickedIndices = [0, 0, 0];
        for (let i = 0; i <= 2; i++) {
            const ri = randint(1 + i, population.length - 1);
            picked[i] = population[ri];
            pickedIndices[i] = ri;
            swap(population, ri, i);
        }
        for (let i = 2; i >= 0; i--) {
            swap(population, pickedIndices[i], i);
        }
        swap(population, parentIndex, 0);
        return picked;
    }
}
