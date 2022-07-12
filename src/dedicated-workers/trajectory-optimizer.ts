importScripts(
    "libs/common.js",
    "libs/trajectory-calculator.js",
    "libs/evolution.js",
    "libs/math.js",
    "libs/physics-3d.js",
    "libs/lambert.js",
    "libs/utils.js"
);

class TrajectoryOptimizer extends WorkerEnvironment {
    private _config!:         Config;
    private _system!:         IOrbitingBody[];
    private _bodiesOrbits!:   OrbitalElements3D[];

    private _depAltitude!:    number;
    private _destAltitude!:   number;
    private _sequence!:       number[];
    private _startDateMin!:   number;
    private _startDateMax!:   number;

    private _bestTrajectory!: TrajectoryCalculator;
    private _bestDeltaV!:     number;
    private _newDeltaVs:      number[] = [];
    private _deltaVs:         number[] = [];

    private _evolver!: Evolution.ChunkedEvolver;

    override onWorkerInitialize(data: any){
        this._config = data.config;
        this._system = data.system;

        // Precompute bodies' orbital elements
        //@ts-ignore
        this._bodiesOrbits = [null];
        for(let i = 1; i < this._system.length; i++) {
            const data = this._system[i].orbit;
            const orbit = Physics3D.orbitElementsFromOrbitData(data);
            this._bodiesOrbits.push(orbit);
        }
    }

    override onWorkerDataPass(data: any){
        this._depAltitude = data.depAltitude;
        this._destAltitude = data.destAltitude;
        this._sequence = data.sequence;
        this._startDateMin = data.startDateMin;
        this._startDateMax = data.startDateMax;
    }

    override onWorkerRun(input: any){
        this._newDeltaVs = [];

        if(input.start){
            // If it's the first generation, we generate configure the evolver and generate
            // a new random population.
            const numLegs = this._sequence.length - 1;
            const agentDim = 3 + numLegs*4 - 2;
            const fitness = (agent: Agent) => {
                // The fitness function calculates the trajectory represented
                // by the agent and update the best trajectory found yet.
                const trajectory = this._computeTrajectory(agent);
                if(trajectory.totalDeltaV < this._bestDeltaV){
                    this._bestDeltaV = trajectory.totalDeltaV;
                    this._bestTrajectory = trajectory;
                }
                
                // Get the circular final orbit
                const lastIdx = trajectory.steps.length-1;
                const finalOrbit = trajectory.steps[lastIdx].orbitElts;

                const totDV = trajectory.totalDeltaV;
                this._newDeltaVs.push(totDV);

                const lastInc = Math.abs(finalOrbit.inclination);
                // Attempt to force a minimal inclination of the
                // circular orbit around the destination body
                // FIX : doesn't work so well...
                return totDV + totDV*lastInc*0.1;
            };
            const trajConfig = this._config.trajectorySearch;
            const {diffWeight} = trajConfig;
            const {minCrossProba, maxCrossProba} = trajConfig;
            const {crossProbaIncr, maxGenerations} = trajConfig;
            const {chunkStart, chunkEnd} = input;

            const evolSettings: EvolutionSettings = {
                maxGens: maxGenerations,
                agentDim, fitness,
                crInc: crossProbaIncr,
                crMin: minCrossProba,
                crMax: maxCrossProba,
                f: diffWeight,
            };
            this._evolver = new Evolution.ChunkedEvolver(chunkStart, chunkEnd, evolSettings);

            this._bestDeltaV = Infinity;

            // Create the first generation and evaluate it
            this._evolver.createRandomPopulationChunk();
            this._evolver.evaluateChunkFitness();
            this._deltaVs = [...this._newDeltaVs];
        } else {
            // If not the first generation, then evolve the current population
            const {population, fitnesses} = input;
            const updated = this._evolver.evolvePopulationChunk(population, fitnesses);

            for(const i of updated){
                this._deltaVs[i] = this._newDeltaVs[i];
            }
        }

        sendResult({
            popChunk:   this._evolver.popChunk,
            fitChunk:   this._evolver.fitChunk,
            dVsChunk:   this._deltaVs,
            bestSteps:  this._bestTrajectory.steps, 
            bestDeltaV: this._bestDeltaV
        });
    }

    /**
     * Computes the trajectory represented by an agent. Throws an error if the trajectory fails at
     * being computed.
     * @param agent An agent representing a trajectory
     * @param maxAttempts The maximum number of attempts to compute the trajectory before throwing an error
     * @returns The computed trajectory
     */
    private _computeTrajectory(agent: Agent, maxAttempts: number = 1000){
        const trajConfig = this._config.trajectorySearch;
        const trajectory = new TrajectoryCalculator(this._system, trajConfig, this._sequence);
        trajectory.addPrecomputedOrbits(this._bodiesOrbits);

        // There can be errors happening during the calculation (like NaN values),
        // therefore we try to calculate the trajectory until the maximum number of attempts is reached.
        // If an error occurs, the agent is randomized.
        let attempts = 0;
        while(attempts < maxAttempts){
            trajectory.setParameters(
                this._depAltitude,
                this._destAltitude,
                this._startDateMin,
                this._startDateMax,
                agent
            );
            let failed = false;
            // FIX: "This radius is never reached" error thrown... why ?
            try {
                trajectory.compute();
                trajectory.recomputeLegsSecondArcs();
            } catch {
                failed = true;
            }
            
            if(failed || Utils.hasNaN(trajectory.steps)) {
                Evolution.randomizeAgent(agent);
                trajectory.reset();
            } else {
                return trajectory;
            }
            
            attempts++;
        }

        throw new Error("Impossible to compute the trajectory.");
    }
}

WorkerEnvironment.init(TrajectoryOptimizer);