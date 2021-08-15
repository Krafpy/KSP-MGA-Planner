{ // <- hack to make typescript consider file scope only
    // Mozilla doesn't support module workers :(
    importScripts("libs/common.js", "libs/math.js", "libs/physics.js", "libs/physics-2d.js");
    
    let system: IOrbitingBody[];
    let config: Config;
    let current: Generator<undefined, (number | undefined)[], unknown> | null = null;

    onWorkerInitialize = data => {
        system = data.system;
        config = data.config;
    };

    onWorkerRun = input => {
        current = evaluateInChunks(input as number[][]);
        sendProgress(0);
    };

    onWorkerContinue = () => {
        if(!current) return;
        const {done, value} = current.next();
        if(done) sendResult(value);
    };

    onWorkerStop = () => current = null;

    /**
     * Calculates the cost of each provided sequences and pauses regularly to send progression.
     * @param sequences The list of sequences to evaluate
     * @returns The cost of each sequences.
     */
    function* evaluateInChunks(sequences: number[][]){
        const results = [];
        const {progressStep} = config.workers;
        
        for(let i = 0; i < sequences.length; i++){
            results.push(evaluateSequence(sequences[i]));
            if(i % progressStep == 0) {
                sendProgress(i);
                yield;
            }
        }
        return results;
    }

    /**
     * Calculates a possible cost in velocity of the sequence by finding the first set of
     * flyby radiuses that reaches the destination body through DFS.
     * @param sequence The sequence to evaluate
     * @returns The estimated cost in velocity of the sequence
     */
    function evaluateSequence(sequence: number[]){
        const bodies = getSequenceBodies(sequence);
        const attractor = system[bodies[0].orbiting];

        // Calculate departure deltaV, considering simple Hohmann transfer
        const depDeltaV = hohmannTransferDeltaV(bodies[0], bodies[1]);
        if(bodies.length == 2) {
            // Calculate relative velocity at encounter with the arrival body after transfer
            const depVel = depDeltaV + bodies[0].circularVel;
            const relativeArrVel = hohmannEncounterRelativeVel(bodies[0], bodies[1], depVel, attractor);
            return Math.abs(depDeltaV) + Math.abs(relativeArrVel);
        }
        
        const statuses = generateInitialStatuses(bodies[0], depDeltaV);

        const {maxEvalStatuses, radiusSamples} = config.flybySequence;
        let evalCount = 0;

        while(statuses.length > 0) {
            evalCount++;
            if(evalCount > maxEvalStatuses) {
                break;
            }

            const status = statuses.pop() as OrbitalState2D;

            const targetBody = bodies[status.target];
            const itsc = calculateNextIntersection(status.pos, status.vel, targetBody, attractor, config);
            if(itsc) {
                const targetBodyVel = getBodyVelocity2D(itsc.pos, targetBody);
                const arrivalVel = getRelativeVelocity2D(itsc.vel, targetBodyVel);

                if(status.target == bodies.length - 1) {
                    return Math.abs(depDeltaV) + mag2(arrivalVel);
                }

                for(let i = radiusSamples - 1; i >= 0; i--){
                    const radius = lerp(targetBody.radius, targetBody.soi, i / radiusSamples);
                    const exitVels = calculateQuickFlyby(radius, arrivalVel, targetBody);

                    statuses.push({
                        pos: itsc.pos,
                        vel: getGlobalVelocity2D(exitVels.v1, targetBodyVel),
                        target: status.target + 1
                    });

                    statuses.push({
                        pos: itsc.pos,
                        vel: getGlobalVelocity2D(exitVels.v2, targetBodyVel),
                        target: status.target + 1
                    });
                }
            }
        }
    }

    /**
     * 
     * @param sequence The sequence to get the bodies from
     * @returns The corresponding sequence of bodies.
     */
    function getSequenceBodies(sequence: number[]) {
        // We suppose the sequence bodies are orbiting around the same attractor
        const bodies: IOrbitingBody[] = [];
        for(const id of sequence){
            bodies.push(system[id]);
        }
        return bodies;
    }

    /**
     * Generates the departure status from various initial ejection velocity conditions.
     * @param depBody The departure body
     * @param depDeltaV The departure deltaV for direct Hohmann transfer
     * @returns The initial statuses to start the search from.
     */
    function generateInitialStatuses(depBody: IOrbitingBody, depDeltaV: number){
        const statuses: OrbitalState2D[] = [];

        const {initVelMaxScale, initVelSamples} = config.flybySequence;
        for(let i = 0; i < initVelSamples; ++i) {
            const scale = (i / initVelSamples) * initVelMaxScale;
            statuses.push({
                pos: {x: depBody.orbit.semiMajorAxis, y: 0},
                vel: {x: 0, y: depDeltaV * scale + depBody.circularVel},
                target: 1
            });
        }

        return statuses;
    }
}