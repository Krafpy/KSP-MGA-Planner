{
    importScripts("libs/common.js");
    
    let config: Config;

    onWorkerInitialize = data => config = data;

    onWorkerRun = input => {
        const {bodies, params} = input;
        const feasible = generateFeasibleSet(bodies, params);
        sendResult(feasible);
    }

    /**
     * Returns the feasible set of body sequences, i.e a list of body ids sequences that respect
     * the constraints of the user settings.
     * @param allowedBodies Bodies reachable according to the user settings
     * @param params Parameters of the sequences to gener
     * @returns The feasible set
     */
    function generateFeasibleSet(allowedBodies: number[], params: SequenceParameters){
        let incFeasibleSet: GeneratingSequence[] = [{
            sequence: [params.departureId],
            resonant: 0,
            backLegs: 0
        }];
        let tempSet: GeneratingSequence[] = [];
        const feasibleSet: number[][] = [];

        const relativePos = getRelativePositions(allowedBodies);
        const feasible = (seq: GeneratingSequence) => checkSequenceFeasibility(seq, relativePos, params);

        const {maxEvalSequences} = config.flybySequence;
        outerloop:
        while(incFeasibleSet.length > 0){
            for(const incSeq of incFeasibleSet){
                for(const bodyId of allowedBodies){
                    const tempSeq = {
                        sequence: [...incSeq.sequence, bodyId],
                        resonant: incSeq.resonant, 
                        backLegs: incSeq.backLegs
                    };

                    if(feasible(tempSeq)) {
                        if(bodyId == params.destinationId) {
                            feasibleSet.push(tempSeq.sequence);
                            if(feasibleSet.length >= maxEvalSequences)
                                break outerloop;
                        } else {
                            tempSet.push(tempSeq);
                        }
                    }
                }
            }
            incFeasibleSet = tempSet;
            tempSet = [];
        }

        return feasibleSet;
    }

    /**
     * Returns a mapping to the relative position/order of bodies from the attractator.
     * @param allowedBodies Bodies allowed to be reached in the sequence, ordered according to their radiuses to the attractor
     * @returns The mapping to relative positions.
     */
    function getRelativePositions(allowedBodies: number[]){
        // We suppose that the bodies are sorted according to their semimajor axis radius
        const relativePos: Map<number, number> = new Map();
        for(let i = 0; i < allowedBodies.length; ++i){
            relativePos.set(allowedBodies[i], i);
        }
        return relativePos;
    }

    /**
     * Checks if a (non fully) generated sequence respects the user contraints and updates the sequence informations.
     * @param seq A (non fully) generated sequence to check
     * @param relativePos The mapping of bodies' relative positions to the attractor
     * @param params The parameters constraining the generated sequences
     * @returns Whether the sequence respects the constraints or not.
     */
    function checkSequenceFeasibility(seq: GeneratingSequence, relativePos: Map<number, number>, params: SequenceParameters) {
        const numSwingBys = seq.sequence.length - 2;
        if(numSwingBys > params.maxSwingBys)
            return false;
        
        const posCurr = <number>relativePos.get(seq.sequence[seq.sequence.length - 1]);
        const posPrev = <number>relativePos.get(seq.sequence[seq.sequence.length - 2]);
        
        const toHigherOrbit = params.destinationId > params.departureId;
        
        if(isBackLeg(posCurr, posPrev, toHigherOrbit)) {
            const jumpSpacing = Math.abs(posPrev - posCurr);
            if(jumpSpacing > params.maxBackSpacing)
                return false;
            seq.backLegs++;
        }

        if(posCurr == posPrev)
            seq.resonant++;
        
        return seq.resonant <= params.maxResonant && seq.backLegs <= params.maxBackLegs;
    }

    /**
     * Returns if a given leg is a back leg according to departure and destination bodies.
     * @param posCurr The relative position of the body reached at the end of the leg
     * @param posPrev The relative position of the starting body of the leg
     * @param toHigherOrbit Whether the destination body has a higher orbit than the departure body
     * @returns Whether this leg is a back leg or not.
     */
    function isBackLeg(posCurr: number, posPrev: number, toHigherOrbit: boolean){
        return (toHigherOrbit && posCurr < posPrev) || (!toHigherOrbit && posCurr > posPrev);
    }
}