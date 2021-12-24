/**
 * Encapsulates a set of functions and variables to evolve a particular population chunk.
 */
class ChunkedEvolver {
    public readonly chunkSize!: number;

    /**
     * Instantiates an evolver object, used to evolve a specified chunk of a whole population.
     * @param chunkStart The start index of the chunk in the population
     * @param chunkEnd The end index (inclusive) of the chunk in the population
     * @param agentDim The dimension size of agents
     * @param fitness The fitness function
     * @param cr The CR coefficient of the DE
     * @param f The F coefficient of the DE
     */
    constructor(
        public readonly chunkStart: number,
        public readonly chunkEnd:   number,
        public readonly agentDim:   number,

        public readonly fitness:    (x: Agent) => number,
        public readonly cr:         number,
        public readonly f:          number,
    ){
        const ce = chunkEnd;
        const cs = chunkStart;
        this.chunkSize = ce - cs + 1;
    }

    /**
     * Creates a random agent with its parameters all set to random values
     * between 0 and 1.
     * @returns A random agent
     */
    public createRandomAgent(){
        const agent: Agent = Array<number>(this.agentDim);
        this.randomizeAgent(agent);
        return agent;
    }

    /**
     * Randomizes an existing agent by setting its parameters to random values
     * between 0 and 1.
     * @param agent The agent to randomize
     */
    public randomizeAgent(agent: Agent){
        for(let i = 0; i < this.agentDim; i++){
            agent[i] = Math.random();
        }
    }

    /**
     * Returns a population chunk with agents whose parameters have been set to a random
     * number between 0 and 1.
     * @returns A random population chunk
     */
    public createRandomPopulationChunk(){
        const popChunk: Agent[] = [];
        for(let i = 0; i < this.chunkSize; i++){
            popChunk.push(this.createRandomAgent());
        }
        return popChunk;
    }

    /**
     * Returns the fitness of each agent in the chunk.
     * @param popChunk The population chunk
     * @param fitness The fitness function
     * @returns The fitness value for each agent in the chunk.
     */
    public evaluateChunkFitness(popChunk: Agent[]){
        const fitChunk: number[] = Array(popChunk.length);
        for(let i = 0; i < popChunk.length; i++) {
            fitChunk[i] = this.fitness(popChunk[i]);
        }
        return fitChunk;
    }

    /**
     * Evolves a chunk of population from generation G to generation G + 1.
     * @param population The whole population at the generation G
     * @param fitnesses The fitnesses of all agents in the population at generation G
     * @returns The new population chunk with it's fitness at generation G + 1
     */
    public evolvePopulationChunk(population: Agent[], fitnesses: number[]){
        const dim = population[0].length;

        const nextPopChunk: Agent[] = Array(this.chunkSize);
        const nextFitChunk: number[] = Array(this.chunkSize);

        for(let j = this.chunkStart; j <= this.chunkEnd; j++) {
            const x = population[j];
            const fx = fitnesses[j];
            
            const [a, b, c] = this._pick3(population, j);
            const ri = randint(0, dim - 1);
            const y: Agent = Array(dim).fill(0);
            for(let i = 0; i < dim; i++){
                if(Math.random() < this.cr || i == ri) {
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
            } else {
                nextPopChunk[index] = x;
                nextFitChunk[index] = fx;
            }
        }

        return {
            popChunk: nextPopChunk,
            fitChunk: nextFitChunk
        }
    }

    /**
    * Selects three random agents in the population that are distinct from each other
    * and distinct from the parent agent.
    * @param population The whole population
    * @param parentIndex The index of the parent, index not to pick
    * @returns Three random distincy agents from the population.
    */
    private _pick3(population: Agent[], parentIndex: number) {
        const swap = (arr: any[], i: number, j: number) => {
            const t = arr[j];
            arr[j] = arr[i];
            arr[i] = t;
        }
        
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