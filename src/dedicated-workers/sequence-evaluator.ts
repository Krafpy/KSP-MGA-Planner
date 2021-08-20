// Mozilla doesn't support module workers :(
importScripts("libs/common.js", "libs/math.js", "libs/physics.js", "libs/physics-2d.js");

class SequenceEvaluator extends WorkerEnvironment {
    private _system!: IOrbitingBody[];
    private _config!: Config;
    
    private _sequences!: number[][];
    private _current: Generator<undefined, (number | undefined)[], unknown> | null = null;
    private _attractor!: ICelestialBody;

    override onWorkerInitialize(data: any){
        this._system = data.system;
        this._config = data.config;
    }

    override onWorkerRun(input: any){
        this._sequences = input;

        const {orbiting} = this._system[this._sequences[0][0]];
        this._attractor = this._system[orbiting];

        this._current = this._evaluateSequenceChunks();
        sendProgress(0);
    }

    override onWorkerContinue(){
        if(!this._current) return;
        const {done, value} = this._current.next();
        if(done) sendResult(value);
    }

    override onWorkerStop(){
        this._current = null;
    }

    /**
     * Calculates the cost of each provided sequences and pauses regularly to send progression.
     * @param sequences The list of sequences to evaluate
     * @returns The cost of each sequences.
     */
    private *_evaluateSequenceChunks(){
        const results = [];
        const {progressStep} = this._config.workers;

        for(let i = 0; i < this._sequences.length; i++){
            results.push(this._evaluateSequence(this._sequences[i]));
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
    private _evaluateSequence(sequence: number[]){
        const bodies = this._bodySequenceOf(sequence);

        // Calculate departure deltaV, considering simple Hohmann transfer
        const depDeltaV = hohmannTransferDeltaV(bodies[0], bodies[1]);

        if(bodies.length == 2) {
            // Calculate relative velocity at encounter with the arrival body after transfer
            const depVel = depDeltaV + bodies[0].circularVel;
            const relativeArrVel = hohmannEncounterRelativeVel(bodies[0], bodies[1], depVel, this._attractor);
            return Math.abs(depDeltaV) + Math.abs(relativeArrVel);
        }
        
        const statuses = this._generateInitialStatuses(bodies[0], depDeltaV);

        const {maxEvalStatuses, radiusSamples} = this._config.flybySequence;
        let evalCount = 0;

        while(statuses.length > 0) {
            evalCount++;
            if(evalCount > maxEvalStatuses) {
                break;
            }

            const status = statuses.pop() as OrbitalState2D;

            const targetBody = bodies[status.target];
            const itsc = calculateNextIntersection(status.pos, status.vel, targetBody, this._attractor);
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
    private _bodySequenceOf(sequence: number[]) {
        const bodies: IOrbitingBody[] = [];
        for(const id of sequence){
            bodies.push(this._system[id]);
        }
        return bodies;
    }

    /**
     * Generates the departure status from various initial ejection velocity conditions.
     * @param depBody The departure body
     * @param depDeltaV The departure deltaV for direct Hohmann transfer
     * @returns The initial statuses to start the search from.
     */
    private _generateInitialStatuses(depBody: IOrbitingBody, depDeltaV: number){
        const statuses: OrbitalState2D[] = [];

        const {initVelMaxScale, initVelSamples} = this._config.flybySequence;
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

initWorker(SequenceEvaluator);