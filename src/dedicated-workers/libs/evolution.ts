/**
 * @param popChunk The population chunk
 * @param fitness The fitness function
 * @returns The fitness value for each agent in the chunk.
 */
function populationChunkFitness(popChunk: Agent[], fitness: (x: Agent) => number){
    const fitChunk: number[] = Array(popChunk.length).fill(0);
    for(let i = 0; i < popChunk.length; i++) {
        fitChunk[i] = fitness(popChunk[i]);
    }
    return fitChunk;
}

/**
 * Evolves a chunk of population from generation G to generation G + 1.
 * @param population The whole population at the generation G
 * @param fitnesses The fitnesses of all agents in the population at generation G
 * @param chunkStart The first index of the chunk to evolve
 * @param chunkEnd The last index of the chunk to evolve
 * @param cr The CR coefficient of DE
 * @param f The F coefficient of DE
 * @param fitness The fitness function
 * @returns The new population chunk with it's fitness at generation G + 1
 */
function evolvePopulationChunk(
    population: Agent[], 
    fitnesses: number[], 
    chunkStart: number, 
    chunkEnd: number, 
    cr: number, 
    f: number,
    fitness: (x: Agent) => number
){
    const chunkSize = chunkEnd - chunkStart + 1;
    const dim = population[0].length;

    const nextPopChunk: (Agent | null)[] = Array(chunkSize).fill(null);
    const nextFitChunk: number[] = Array(chunkSize).fill(0);

    for(let j = chunkStart; j <= chunkEnd; j++) {
        const x = population[j];
        const fx = fitnesses[j];
        
        const [a, b, c] = pick3(population, j);
        const ri = randint(0, dim - 1);
        const y: Agent = Array(dim).fill(0);
        for(let i = 0; i < dim; i++){
            if(Math.random() < cr || i == ri) {
                y[i] = a[i] + f * (b[i] - c[i]);
            } else {
                y[i] = x[i];
            }
        }

        const fy = fitness(y);
        const index = j - chunkStart;
        if(fy < fx) {
            nextPopChunk[index] = y;
            nextFitChunk[index] = fy;
        } else {
            nextPopChunk[index] = x;
            nextFitChunk[index] = fx;
        }
    }

    return {
        popChunk: nextPopChunk as Agent[],
        fitChunk: nextFitChunk
    }
}

/**
 * Selects three random agents in the population that are distinct from each other
 * and distinct from the parent agent, in a O(1) time complexity.
 * @param population The whole population
 * @param parentIndex The index of the parent, index not to pick
 * @returns Three random distincy agents from the population.
 */
function pick3(population: Agent[], parentIndex: number) {
    swap(population, parentIndex, 0);

    const picked: (Agent | null)[] = [null, null, null];
    const pickedIndices = [0, 0, 0];
    for(let i = 0; i <= 2; i++) {
        const ri = randint(1 + i, population.length - 1);
        picked[i] = population[ri];
        pickedIndices[i] = ri;
        swap(population, ri, i);
    }

    for(let i = 2; i >= 0; i--){
        swap(population, pickedIndices[i], i);
    }
    swap(population, parentIndex, 0);

    return picked as Agent[];
}

function swap(arr: any[], i: number, j: number){
    const t = arr[j];
    arr[j] = arr[i];
    arr[i] = t;
}