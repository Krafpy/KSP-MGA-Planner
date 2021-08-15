"use strict";
{
    importScripts("libs/common.js", "libs/evolution.js", "libs/math.js", "libs/physics.js", "libs/physics-3d.js", "libs/lambert.js", "libs/trajectory-calculator.js");
    let config;
    let system;
    let depAltitude;
    let sequence;
    let startDateMin;
    let startDateMax;
    let bestDeltaV;
    let bestSteps;
    onWorkerInitialize = data => {
        config = data.config;
        system = data.system;
    };
    onWorkerDataPass = data => {
        depAltitude = data.depAltitude;
        sequence = data.sequence;
        startDateMin = data.startDateMin;
        startDateMax = data.startDateMax;
    };
    onWorkerRun = input => {
        if (input.start) {
            bestDeltaV = Infinity;
            const chunkSize = input.chunkEnd - input.chunkStart + 1;
            const popChunk = createRandomMGAPopulationChunk(chunkSize);
            const dvChunk = populationChunkFitness(popChunk, evaluate);
            sendResult({
                bestSteps: bestSteps,
                bestDeltaV: bestDeltaV,
                fitChunk: dvChunk,
                popChunk: popChunk,
            });
        }
        else {
            const { crossoverProba, diffWeight } = config.trajectorySearch;
            const results = evolvePopulationChunk(input.population, input.deltaVs, input.chunkStart, input.chunkEnd, crossoverProba, diffWeight, evaluate);
            sendResult({
                ...results,
                bestSteps: bestSteps,
                bestDeltaV: bestDeltaV
            });
        }
    };
    function evaluate(params) {
        const trajectory = computeTrajectory(params);
        if (trajectory.totalDeltaV < bestDeltaV) {
            bestDeltaV = trajectory.totalDeltaV;
            bestSteps = trajectory.steps;
        }
        return trajectory.totalDeltaV;
    }
    ;
    function computeTrajectory(params) {
        const calculate = () => {
            const trajectory = new TrajectoryCalculator(system, config.trajectorySearch, sequence);
            trajectory.setParameters(depAltitude, startDateMin, startDateMax, params);
            trajectory.compute();
            return trajectory;
        };
        let trajectory = calculate();
        while (!trajectory.noError) {
            randomizeExistingAgent(params);
            trajectory = calculate();
        }
        return trajectory;
    }
    function createRandomMGAPopulationChunk(chunkSize) {
        const popChunk = [];
        for (let i = 0; i < chunkSize; i++) {
            popChunk.push(createRandomMGAAgent());
        }
        return popChunk;
    }
    function createRandomMGAAgent() {
        const dim = 4 * (sequence.length - 1) + 2;
        const solution = Array(dim).fill(0);
        solution[0] = randomInInterval(startDateMin, startDateMax);
        solution[1] = randomInInterval(1, 3);
        for (let i = 1; i < sequence.length; i++) {
            const j = 2 + (i - 1) * 4;
            const { legDuration, dsmOffset } = legDurationAndDSM(i);
            solution[j] = legDuration;
            solution[j + 1] = dsmOffset;
            const { theta, phi } = randomPointOnSphereRing(0, Math.PI / 2);
            solution[j + 2] = theta;
            solution[j + 3] = phi;
        }
        return solution;
    }
    function randomizeExistingAgent(agent) {
        const newAgent = createRandomMGAAgent();
        for (let i = 0; i < agent.length; i++) {
            agent[i] = newAgent[i];
        }
    }
    function legDurationAndDSM(index) {
        const isResonant = sequence[index - 1] == sequence[index];
        const { dsmOffsetMin, dsmOffsetMax } = config.trajectorySearch;
        if (isResonant) {
            const sideralPeriod = system[sequence[index]].orbit.sideralPeriod;
            const revs = randomInInterval(1, 4);
            const legDuration = revs * sideralPeriod;
            const minOffset = clamp((revs - 1) / revs, dsmOffsetMin, dsmOffsetMax);
            const dsmOffset = randomInInterval(minOffset, dsmOffsetMax);
            return { legDuration, dsmOffset };
        }
        else {
            const body1 = system[sequence[index - 1]];
            const body2 = system[sequence[index]];
            const attractor = system[body1.orbiting];
            const period = getHohmannPeriod(body1, body2, attractor);
            const legDuration = randomInInterval(0.1, 1) * period;
            const dsmOffset = randomInInterval(dsmOffsetMin, dsmOffsetMax);
            return { legDuration, dsmOffset };
        }
    }
}
