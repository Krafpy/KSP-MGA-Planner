/**
 * Encapsulates a set of functions and variables to evolve a particular population chunk.
 */

namespace Evolution {
    export class ChunkedEvolver {
        public readonly chunkSize!:  number;
        public readonly chunkStart!: number;
        public readonly chunkEnd!:   number;
        public readonly agentDim!:   number;

        public popChunk: Agent[] = [];
        public fitChunk: number[] = [];
    
        public fitness!: (x: Agent) => number;
        public crMin!: number;
        public crMax!: number;
        public crInc!: number;
        public f!:  number;
        
        public readonly maxGens!: number;
        public generation = 0;
    
        /**
         * Instantiates an evolver object, used to evolve a specified chunk of a whole population.
         * @param chunkStart The start index of the chunk in the population
         * @param chunkEnd The end index (inclusive) of the chunk in the population
         * @param settings The settings for the evolution
         */
        constructor(chunkStart: number, chunkEnd: number, settings: EvolutionSettings){
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

        /**
         * Creates a new population chunk with agents whose parameters have been set to a random
         * number between 0 and 1.
         */
        public createRandomPopulationChunk(){
            for(let i = 0; i < this.chunkSize; i++){
                this.popChunk[i] = createRandomAgent(this.agentDim);
            }
        }

        /**
         * Computes the fitness of each agent in the chunk.
         */
        public evaluateChunkFitness(){
            for(let i = 0; i < this.chunkSize; i++) {
                this.fitChunk[i] = this.fitness(this.popChunk[i]);
            }
        }

        /**
         * Evolves a chunk of population from generation G to generation G + 1.
         * @param population The whole population at the generation G
         * @param fitnesses The fitnesses of all agents in the population at generation G
         * @returns Returns the list of chunk agent indices that have been modified.
         */
        public evolvePopulationChunk(population: Agent[], fitnesses: number[]){
            const dim = this.agentDim;

            const updated: number[] = [];
            
            const nextPopChunk = Array<Agent>(this.chunkSize);
            const nextFitChunk = Array<number>(this.chunkSize);

            const genRatio = this.generation/this.maxGens;
            const genCoeff = Math.pow(1 - genRatio, this.crInc);
            const cr = this.crMax + (this.crMin - this.crMax) * genCoeff;

            for(let j = this.chunkStart; j <= this.chunkEnd; j++) {
                const x = population[j];
                const fx = fitnesses[j];
                
                const [a, b, c] = pick3(population, j);
                const ri = randint(0, dim - 1);
                const y: Agent = Array(dim).fill(0);
                for(let i = 0; i < dim; i++){
                    if(Math.random() < cr || i == ri) {
                        y[i] = a[i] + this.f * (b[i] - c[i]);
                    } else {
                        y[i] = x[i];
                    }
                    y[i] = clamp(y[i], 0, 1);
                }

                const fy = this.fitness(y);
                const index = j - this.chunkStart;
                if(fy < fx) {
                    nextPopChunk[index] = y;
                    nextFitChunk[index] = fy;
                    updated.push(index);
                } else {
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

    /**
     * Creates a random agent with its parameters all set to random values
     * between 0 and 1.
     * @returns A random agent
     */
    export function createRandomAgent(dim: number){
        const agent: Agent = Array<number>(dim);
        for(let i = 0; i < dim; i++){
            agent[i] = Math.random();
        }
        return agent;
    }

    /**
     * Randomizes an existing agent by setting its parameters to random values
     * between 0 and 1.
     * @param agent The agent to randomize
     */
    export function randomizeAgent(agent: Agent){
        for(let i = 0; i < agent.length; i++){
            agent[i] = Math.random();
        }
    }

    /**
    * Selects three random agents in the population that are distinct from each other
    * and distinct from the parent agent.
    * @param population The whole population
    * @param parentIndex The index of the parent, index not to pick
    * @returns Three random distincy agents from the population.
    */
    function pick3(population: Agent[], parentIndex: number) {
        const swap = (arr: any[], i: number, j: number) => {
            const t = arr[j];
            arr[j] = arr[i];
            arr[i] = t;
        };

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
}