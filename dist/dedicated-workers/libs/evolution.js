"use strict";
var Evolution;
(function (Evolution) {
    class ChunkedEvolver {
        constructor(chunkStart, chunkEnd, settings) {
            this.popChunk = [];
            this.fitChunk = [];
            this.generation = 0;
            this.chunkStart = chunkStart;
            this.chunkEnd = chunkEnd;
            this.chunkSize = chunkEnd - chunkStart + 1;
            this.agentDim = settings.agentDim;
            this.fitness = settings.fitness;
            this.crMin = settings.crMin;
            this.crMax = settings.crMax;
            this.crInc = settings.crInc;
            this.f = settings.f;
            this.maxGens = settings.maxGens;
        }
        createRandomPopulationChunk() {
            for (let i = 0; i < this.chunkSize; i++) {
                this.popChunk[i] = createRandomAgent(this.agentDim);
            }
        }
        evaluateChunkFitness() {
            for (let i = 0; i < this.chunkSize; i++) {
                this.fitChunk[i] = this.fitness(this.popChunk[i]);
            }
        }
        evolvePopulationChunk(population, fitnesses) {
            const dim = this.agentDim;
            const updated = [];
            const nextPopChunk = Array(this.chunkSize);
            const nextFitChunk = Array(this.chunkSize);
            const genRatio = this.generation / this.maxGens;
            const genCoeff = Math.pow(1 - genRatio, this.crInc);
            const cr = this.crMax + (this.crMin - this.crMax) * genCoeff;
            for (let j = this.chunkStart; j <= this.chunkEnd; j++) {
                const x = population[j];
                const fx = fitnesses[j];
                const [a, b, c] = pick3(population, j);
                const ri = randint(0, dim - 1);
                const y = Array(dim).fill(0);
                for (let i = 0; i < dim; i++) {
                    if (Math.random() < cr || i == ri) {
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
            this.popChunk = nextPopChunk;
            this.fitChunk = nextFitChunk;
            this.generation++;
            return updated;
        }
    }
    Evolution.ChunkedEvolver = ChunkedEvolver;
    function createRandomAgent(dim) {
        const agent = Array(dim);
        for (let i = 0; i < dim; i++) {
            agent[i] = Math.random();
        }
        return agent;
    }
    Evolution.createRandomAgent = createRandomAgent;
    function randomizeAgent(agent) {
        for (let i = 0; i < agent.length; i++) {
            agent[i] = Math.random();
        }
    }
    Evolution.randomizeAgent = randomizeAgent;
    function pick3(population, parentIndex) {
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
})(Evolution || (Evolution = {}));
