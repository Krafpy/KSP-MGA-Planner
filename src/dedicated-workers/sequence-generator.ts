importScripts("libs/common.js");

class SequenceGenerator extends WorkerEnvironment {
    private _config!: Config;
    private _bodies!: number[];
    private _params!: SequenceParameters;
    private _relativePos!: number[];

    override onWorkerInitialize(data: any){
        this._config = data;
    }

    override onWorkerRun(input: any){
        const {bodies, params} = input;
        this._bodies = bodies;
        this._params = params;
        this._getRelativePositions();
        const feasible = this._generateFeasibleSet();
        sendResult(feasible);
    }

    /**
     * Returns the feasible set of body sequences, i.e a list of body ids sequences that respect
     * the constraints of the user settings.
     * @returns The feasible set
     */
    private _generateFeasibleSet(){
        let incFeasibleSet: GeneratingSequence[] = [{
            sequence: [this._params.departureId],
            resonant: 0,
            backLegs: 0,
            backSpacingExceeded: false
        }];
        let tempSet: GeneratingSequence[] = [];
        const feasibleSet: number[][] = [];

        const {maxEvalSequences} = this._config.flybySequence;
        outerloop:
        while(incFeasibleSet.length > 0){
            for(const incSeq of incFeasibleSet){
                for(const bodyId of this._bodies){
                    const tempSeq = {
                        sequence: [...incSeq.sequence, bodyId],
                        resonant: incSeq.resonant, 
                        backLegs: incSeq.backLegs,
                        backSpacingExceeded: false
                    };
                    this._updateSequenceInfo(tempSeq);
                    if(this._isSequenceFeasible(tempSeq)) {
                        if(bodyId == this._params.destinationId) {
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
     * Calculates a mapping to the relative position/order of bodies from the attractator.
     */
    private _getRelativePositions(){
        // We suppose that the bodies are sorted according to their semimajor axis radius
        const maxId = Math.max(...this._bodies);
        const relativePos = Array<number>(maxId + 1).fill(0);
        for(let i = 0; i < this._bodies.length; ++i){
            relativePos[this._bodies[i]] = i;
        }
        this._relativePos = relativePos;
    }

    /**
     * Checks if a (non fully) generated sequence respects the user contraints.
     * @param info A (non fully) generated sequence to check
     * @returns Whether the sequence respects the constraints or not.
     */
    private _isSequenceFeasible(info: GeneratingSequence) {
        const params = this._params;

        const numSwingBys = info.sequence.length - 2;
        if(numSwingBys > params.maxSwingBys)
            return false;

        const resonancesOk = info.resonant <= this._params.maxResonant;
        const backLegsOk   = info.backLegs <= this._params.maxBackLegs;

        return resonancesOk && backLegsOk && !info.backSpacingExceeded;
    }

    /**
     * Updates the informations about a generating sequence which received another step.
     * @param info The (non fully) generated sequence to update
     */
    private _updateSequenceInfo(info: GeneratingSequence) {
        const params = this._params;

        const {sequence} = info;
        const posCurr = this._relativePos[sequence[sequence.length - 1]];
        const posPrev = this._relativePos[sequence[sequence.length - 2]];
        
        const toHigherOrbit = params.destinationId > params.departureId;
        const isBackLeg = (toHigherOrbit && posCurr < posPrev) || (!toHigherOrbit && posCurr > posPrev);

        const spacing = Math.abs(posCurr - posPrev);
        info.backSpacingExceeded = isBackLeg && spacing > params.maxBackSpacing;
        
        if(isBackLeg) info.backLegs++;
        if(posCurr == posPrev) info.resonant++;
    }
}

initWorker(SequenceGenerator);