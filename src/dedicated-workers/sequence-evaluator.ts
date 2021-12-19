// Mozilla doesn't support module workers :(
importScripts("libs/common.js", "libs/math.js", "libs/physics-2d.js");

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
        if(!this._current)
            return;
        const {done, value} = this._current.next();
        if(done)
            sendResult(value);
    }

    override onWorkerStop() {this._current = null;}

    /**
     * Calculates the cost of each provided sequences and pauses regularly to send progression.
     * @param sequences The list of sequences to evaluate
     * @returns The cost of each sequences.
     */
    private *_evaluateSequenceChunks() {
        const results = [];
        const {progressStep} = this._config.workers;

        for(let i = 0; i < this._sequences.length; i++){
            const cost = this._evaluateSequence(this._sequences[i]);
            results.push(cost);
            if(i % progressStep == 0) {
                sendProgress(i);
                yield;
            }
        }
        return results;
    }

    /**
     * Computes the deltaV cost of an Hohmaan transfer between
     * the two bodys' orbits.
     * @param body1 The body whose orbit is the departure orbit
     * @param body2 The body whose orbit is the targeted orbit
     * @returns The transfer DV cost
     */
    private _directHohmannTransferCost(body1: IOrbitingBody, body2: IOrbitingBody){
        const attr = this._attractor;
        const r1 = body1.orbit.semiMajorAxis;
        const r2 = body2.orbit.semiMajorAxis;
        const depDV = Physics2D.hohmannToEllipseDeltaV(attr, r1, r2);
        const arrDV = Physics2D.hohmannCircularDeltaV(attr, r1, r2);
        return Math.abs(depDV) + Math.abs(arrDV);
    }

    /**
     * Generates the several first nodes at the departure, i.e. generates all states
     * to be tested : from a perfect Hohmaan transfer orbit to an eccentricized Hohmann
     * tranfser orbit with a scaled ejection deltaV.
     * @param depBody The departure body
     * @param nextBody The following body in the sequence
     * @returns The initial test nodes
     */
    private _generateInitialNodes(depBody: IOrbitingBody, nextBody: IOrbitingBody){
        const nodes: EvaluationNode[] = [];

        const attr = this._attractor;
        const r1 = depBody.orbit.semiMajorAxis;
        const r2 = nextBody.orbit.semiMajorAxis;
        const hohDV = Physics2D.hohmannToEllipseDeltaV(attr, r1, r2);

        const {initVelMaxScale, initVelSamples} = this._config.flybySequence;
        for(let i = initVelSamples; i > 0; i--) {
            const scale = lerp(1, initVelMaxScale, i / initVelSamples);
            const dv = hohDV * scale;
            nodes.push({
                state: {
                    pos: {x: depBody.orbit.semiMajorAxis, y: 0},
                    vel: {x: 0, y: dv + depBody.circularVel}
                },
                next: 1,
                depDV: dv
            });
        }

        return nodes;
    }

    /**
     * Calculates a possible cost in velocity of the sequence by finding the first set of
     * flyby radiuses that reaches the destination body through DFS.
     * @param sequence The sequence to evaluate
     * @returns The idealized estimated DV cost of the sequence, or undefined if the sequence is impossible
     */
    private _evaluateSequence(sequence: number[]){
        const bodies: IOrbitingBody[] = [];
        for(const id of sequence){
            bodies.push(this._system[id]);
        }
        const attr = this._attractor;

        // If there is no intermediate body, calculate the direct Hohmaan transfer cost
        if(bodies.length == 2)
            return this._directHohmannTransferCost(bodies[0], bodies[1]);
        
        const nodes = this._generateInitialNodes(bodies[0], bodies[1]);
        const {maxEvalStatuses, radiusSamples} = this._config.flybySequence;
        let evalCount = 0;

        // Implementation of DFS to find if the sequence is feasible.
        // Stores the total deltaV required to go from the departure orbit to the arrival orbit
        // (i.e. departure DV + relative arrival velocity)
        while(nodes.length > 0) {
            if(++evalCount > maxEvalStatuses)
                break;

            const node = nodes.pop() as EvaluationNode;
            const {state} = node;
            const tgBody = bodies[node.next];

            const itscState = Physics2D.computeNextBodyOrbitIntersection(attr, state, tgBody);
            if(itscState) {
                if(node.next == bodies.length - 1) {
                    const arrVel = Physics2D.relativeVelocity(itscState, tgBody);
                    return Math.abs(node.depDV) + mag2(arrVel);
                }

                for(let i = radiusSamples - 1; i >= 0; i--){
                    const rp = lerp(tgBody.radius, tgBody.soi, i / radiusSamples);
                    const {state1, state2} = Physics2D.computeFlybyExitVelocities(tgBody, itscState, rp);

                    const next = node.next + 1;
                    const depDV = node.depDV;
                    nodes.push({state: state1, next, depDV});
                    nodes.push({state: state2, next, depDV});
                }
            }
        }
    }
}

initWorker(SequenceEvaluator);