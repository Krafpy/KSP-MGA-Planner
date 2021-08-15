"use strict";
function populationChunkFitness(popChunk, fitness) {
    const fitChunk = Array(popChunk.length).fill(0);
    for (let i = 0; i < popChunk.length; i++) {
        fitChunk[i] = fitness(popChunk[i]);
    }
    return fitChunk;
}
function evolvePopulationChunk(population, fitnesses, chunkStart, chunkEnd, cr, f, fitness) {
    const chunkSize = chunkEnd - chunkStart + 1;
    const dim = population[0].length;
    const nextPopChunk = Array(chunkSize).fill(null);
    const nextFitChunk = Array(chunkSize).fill(0);
    for (let j = chunkStart; j <= chunkEnd; j++) {
        const x = population[j];
        const fx = fitnesses[j];
        const [a, b, c] = pick3(population, j);
        const ri = randint(0, dim - 1);
        const y = Array(dim).fill(0);
        for (let i = 0; i < dim; i++) {
            if (Math.random() < cr || i == ri) {
                y[i] = a[i] + f * (b[i] - c[i]);
            }
            else {
                y[i] = x[i];
            }
        }
        const fy = fitness(y);
        const index = j - chunkStart;
        if (fy < fx) {
            nextPopChunk[index] = y;
            nextFitChunk[index] = fy;
        }
        else {
            nextPopChunk[index] = x;
            nextFitChunk[index] = fx;
        }
    }
    return {
        popChunk: nextPopChunk,
        fitChunk: nextFitChunk
    };
}
function pick3(population, parentIndex) {
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
function swap(arr, i, j) {
    const t = arr[j];
    arr[j] = arr[i];
    arr[i] = t;
}
