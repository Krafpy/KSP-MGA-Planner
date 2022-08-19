"use strict";
importScripts("libs/common.js", "libs/trajectory-calculator.js", "libs/evolution.js", "libs/math.js", "libs/physics-3d.js", "libs/lambert.js", "libs/utils.js");
class TrajectoryOptimizer extends WorkerEnvironment {
    constructor() {
        super(...arguments);
        this._newDeltaVs = [];
        this._deltaVs = [];
    }
    onWorkerInitialize(data) {
        this._config = data.config;
        this._system = data.system;
        this._bodiesOrbits = [null];
        for (let i = 1; i < this._system.length; i++) {
            const data = this._system[i].orbit;
            const orbit = Physics3D.orbitElementsFromOrbitData(data);
            this._bodiesOrbits.push(orbit);
        }
    }
    onWorkerDataPass(data) {
        this._sequence = data.sequence;
        this._settings = data.settings;
    }
    onWorkerRun(input) {
        this._newDeltaVs = [];
        if (input.start) {
            const numLegs = this._sequence.length - 1;
            const agentDim = 3 + numLegs * 4 - 2;
            const fitness = (agent) => {
                const trajectory = this._computeTrajectory(agent);
                if (trajectory.totalDeltaV < this._bestDeltaV) {
                    this._bestDeltaV = trajectory.totalDeltaV;
                    this._bestTrajectory = trajectory;
                }
                const lastIdx = trajectory.steps.length - 1;
                const lastStep = trajectory.steps[lastIdx];
                const finalOrbit = lastStep.orbitElts;
                const totDV = trajectory.totalDeltaV;
                this._newDeltaVs.push(totDV);
                const lastInc = Math.abs(finalOrbit.inclination);
                let periVelCost = 0;
                if (this._settings.noInsertion) {
                    const finalBody = this._system[lastStep.attractorId];
                    const periapsis = this._settings.destAltitude + finalBody.radius;
                    const periVel = Physics3D.velocityAtRadius(finalOrbit, finalBody, periapsis);
                    const circDV = periVel - Physics3D.circularVelocity(finalBody, periapsis);
                    periVelCost = circDV;
                }
                return totDV + totDV * lastInc * 0.1 + periVelCost;
            };
            const trajConfig = this._config.trajectorySearch;
            const { diffWeight } = trajConfig;
            const { minCrossProba, maxCrossProba } = trajConfig;
            const { crossProbaIncr, maxGenerations } = trajConfig;
            const { chunkStart, chunkEnd } = input;
            const evolSettings = {
                maxGens: maxGenerations,
                agentDim, fitness,
                crInc: crossProbaIncr,
                crMin: minCrossProba,
                crMax: maxCrossProba,
                f: diffWeight,
            };
            this._evolver = new Evolution.ChunkedEvolver(chunkStart, chunkEnd, evolSettings);
            this._bestDeltaV = Infinity;
            this._evolver.createRandomPopulationChunk();
            this._evolver.evaluateChunkFitness();
            this._deltaVs = [...this._newDeltaVs];
        }
        else {
            const { population, fitnesses } = input;
            const updated = this._evolver.evolvePopulationChunk(population, fitnesses);
            for (const i of updated) {
                this._deltaVs[i] = this._newDeltaVs[i];
            }
        }
        this._bestTrajectory.computeStartingMeanAnomalies();
        sendResult({
            popChunk: this._evolver.popChunk,
            fitChunk: this._evolver.fitChunk,
            dVsChunk: this._deltaVs,
            bestSteps: this._bestTrajectory.steps,
            bestDeltaV: this._bestDeltaV
        });
    }
    _computeTrajectory(agent, maxAttempts = 1000) {
        const trajConfig = this._config.trajectorySearch;
        const trajectory = new TrajectoryCalculator(this._system, trajConfig, this._sequence);
        trajectory.addPrecomputedOrbits(this._bodiesOrbits);
        let attempts = 0;
        while (attempts < maxAttempts) {
            trajectory.setParameters(this._settings, agent);
            let failed = false;
            try {
                trajectory.compute();
                trajectory.recomputeLegsSecondArcs();
            }
            catch {
                failed = true;
            }
            if (failed || Utils.hasNaN(trajectory.steps)) {
                Evolution.randomizeAgent(agent);
                trajectory.reset();
            }
            else {
                return trajectory;
            }
            attempts++;
        }
        throw new Error("Impossible to compute the trajectory.");
    }
}
WorkerEnvironment.init(TrajectoryOptimizer);
