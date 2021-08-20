"use strict";
importScripts("libs/common.js", "libs/evolution.js", "libs/math.js", "libs/physics.js", "libs/physics-3d.js", "libs/lambert.js", "libs/trajectory-calculator.js");
class TrajectoryOptimizer extends WorkerEnvironment {
    onWorkerInitialize(data) {
        this._config = data.config;
        this._system = data.system;
    }
    onWorkerDataPass(data) {
        this._depAltitude = data.depAltitude;
        this._sequence = data.sequence;
        this._startDateMin = data.startDateMin;
        this._startDateMax = data.startDateMax;
    }
    onWorkerRun(input) {
        const evaluate = (params) => this._evaluate(params);
        if (input.start) {
            this._bestDeltaV = Infinity;
            const chunkSize = input.chunkEnd - input.chunkStart + 1;
            const popChunk = this._createRandomMGAPopulationChunk(chunkSize);
            const dvChunk = populationChunkFitness(popChunk, evaluate);
            sendResult({
                bestSteps: this._bestSteps,
                bestDeltaV: this._bestDeltaV,
                fitChunk: dvChunk,
                popChunk: popChunk,
            });
        }
        else {
            const { crossoverProba, diffWeight } = this._config.trajectorySearch;
            const results = evolvePopulationChunk(input.population, input.deltaVs, input.chunkStart, input.chunkEnd, crossoverProba, diffWeight, evaluate);
            sendResult({
                ...results,
                bestSteps: this._bestSteps,
                bestDeltaV: this._bestDeltaV
            });
        }
    }
    _evaluate(params) {
        const trajectory = this._computeTrajectory(params);
        if (trajectory.totalDeltaV < this._bestDeltaV) {
            this._bestDeltaV = trajectory.totalDeltaV;
            this._bestSteps = trajectory.steps;
        }
        return trajectory.totalDeltaV;
    }
    ;
    _computeTrajectory(params) {
        const calculate = () => {
            const trajectory = new TrajectoryCalculator(this._system, this._config.trajectorySearch, this._sequence);
            trajectory.setParameters(this._depAltitude, this._startDateMin, this._startDateMax, params);
            trajectory.compute();
            return trajectory;
        };
        let trajectory = calculate();
        while (!trajectory.noError) {
            this._randomizeExistingAgent(params);
            trajectory = calculate();
        }
        return trajectory;
    }
    _createRandomMGAPopulationChunk(chunkSize) {
        const popChunk = [];
        for (let i = 0; i < chunkSize; i++) {
            popChunk.push(this._createRandomMGAAgent());
        }
        return popChunk;
    }
    _createRandomMGAAgent() {
        const dim = 4 * (this._sequence.length - 1) + 2;
        const solution = Array(dim).fill(0);
        solution[0] = randomInInterval(this._startDateMin, this._startDateMax);
        solution[1] = randomInInterval(1, 3);
        for (let i = 1; i < this._sequence.length; i++) {
            const j = 2 + (i - 1) * 4;
            const { legDuration, dsmOffset } = this._legDurationAndDSM(i);
            solution[j] = legDuration;
            solution[j + 1] = dsmOffset;
            const { theta, phi } = randomPointOnSphereRing(0, Math.PI / 2);
            solution[j + 2] = theta;
            solution[j + 3] = phi;
        }
        return solution;
    }
    _randomizeExistingAgent(agent) {
        const newAgent = this._createRandomMGAAgent();
        for (let i = 0; i < agent.length; i++) {
            agent[i] = newAgent[i];
        }
    }
    _legDurationAndDSM(index) {
        const isResonant = this._sequence[index - 1] == this._sequence[index];
        const { dsmOffsetMin, dsmOffsetMax } = this._config.trajectorySearch;
        if (isResonant) {
            const sideralPeriod = this._system[this._sequence[index]].orbit.sideralPeriod;
            const revs = randomInInterval(1, 4);
            const legDuration = revs * sideralPeriod;
            const minOffset = clamp((revs - 1) / revs, dsmOffsetMin, dsmOffsetMax);
            const dsmOffset = randomInInterval(minOffset, dsmOffsetMax);
            return { legDuration, dsmOffset };
        }
        else {
            const body1 = this._system[this._sequence[index - 1]];
            const body2 = this._system[this._sequence[index]];
            const attractor = this._system[body1.orbiting];
            const period = getHohmannPeriod(body1, body2, attractor);
            const legDuration = randomInInterval(0.1, 1) * period;
            const dsmOffset = randomInInterval(dsmOffsetMin, dsmOffsetMax);
            return { legDuration, dsmOffset };
        }
    }
}
initWorker(TrajectoryOptimizer);
