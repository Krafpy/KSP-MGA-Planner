"use strict";
importScripts("libs/common.js", "libs/evolution.js", "libs/math.js", "libs/physics-3d.js", "libs/lambert.js", "libs/trajectory-calculator.js");
class TrajectoryOptimizer extends WorkerEnvironment {
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
        this._depAltitude = data.depAltitude;
        this._sequence = data.sequence;
        this._startDateMin = data.startDateMin;
        this._startDateMax = data.startDateMax;
    }
    onWorkerRun(input) {
        if (input.start) {
            const numLegs = this._sequence.length - 1;
            const agentDim = 3 + numLegs * 4 - 2;
            const fitness = (agent) => {
                const trajectory = this._computeTrajectory(agent);
                if (trajectory.totalDeltaV < this._bestDeltaV) {
                    this._bestDeltaV = trajectory.totalDeltaV;
                    this._bestTrajectory = trajectory;
                }
                return trajectory.totalDeltaV;
            };
            const trajConfig = this._config.trajectorySearch;
            const { crossoverProba, diffWeight } = trajConfig;
            const { chunkStart, chunkEnd } = input;
            this._evolver = new ChunkedEvolver(chunkStart, chunkEnd, agentDim, fitness, crossoverProba, diffWeight);
            this._bestDeltaV = Infinity;
            const popChunk = this._evolver.createRandomPopulationChunk();
            const dvChunk = this._evolver.evaluateChunkFitness(popChunk);
            this._bestTrajectory.recomputeLegsSecondArcs();
            sendResult({
                bestSteps: this._bestTrajectory.steps,
                bestDeltaV: this._bestDeltaV,
                fitChunk: dvChunk,
                popChunk: popChunk,
            });
        }
        else {
            const { population, deltaVs } = input;
            const { popChunk, fitChunk } = this._evolver.evolvePopulationChunk(population, deltaVs);
            this._bestTrajectory.recomputeLegsSecondArcs();
            sendResult({
                popChunk, fitChunk,
                bestSteps: this._bestTrajectory.steps,
                bestDeltaV: this._bestDeltaV
            });
        }
    }
    _computeTrajectory(agent, maxAttempts = 1000) {
        const trajConfig = this._config.trajectorySearch;
        const trajectory = new TrajectoryCalculator(this._system, trajConfig, this._sequence);
        trajectory.addPrecomputedOrbits(this._bodiesOrbits);
        let attempts = 0;
        while (attempts < maxAttempts) {
            trajectory.setParameters(this._depAltitude, this._startDateMin, this._startDateMax, agent);
            let failed = false;
            try {
                trajectory.compute();
            }
            catch {
                failed = true;
            }
            if (failed || trajectory.mathError) {
                this._evolver.randomizeAgent(agent);
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
