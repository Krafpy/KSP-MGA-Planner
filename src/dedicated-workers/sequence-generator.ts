importScripts("libs/common.js");

class SequenceGenerator extends WorkerEnvironment {
    private _config!: Config;
    private _bodies!: number[];
    private _params!: SequenceParameters;
    private _toHigherOrbit!: boolean;
    private _relativePos!: number[];

    override onWorkerInitialize(data: any){
        this._config = data;
    }

    override onWorkerRun(input: any){
        const {bodies, params} = input;
        this._bodies = bodies;
        this._params = params;
        this._toHigherOrbit = params.destinationId > params.departureId;

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
            maxBackSpacing: 0
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
                        maxBackSpacing: incSeq.maxBackSpacing
                    };
                    this._updateSequenceInfo(tempSeq);
                    if(this._isSequenceValid(tempSeq)) {
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
     private _isSequenceValid(info: GeneratingSequence) {
        const params = this._params;

        const numSwingBys = info.sequence.length - 2;
        if(numSwingBys > params.maxSwingBys)
            return false;

        if(info.resonant > params.maxResonant)
            return false;
        if(info.backLegs > params.maxBackLegs)
            return false;

        return info.maxBackSpacing <= params.maxBackSpacing;
    }

    /**
     * Updates the informations about a generating sequence which received another step.
     * @param info The (non fully) generated sequence to update
     */
    private _updateSequenceInfo(info: GeneratingSequence) {
        const {sequence} = info;
        const len = sequence.length;
        const pcur = this._relativePos[sequence[len-1]];
        const ppre = this._relativePos[sequence[len-2]];
        
        const toHO = this._toHigherOrbit;
        if((toHO && pcur < ppre) || (!toHO && pcur > ppre)) {
            info.backLegs++;
            const spacing = Math.abs(pcur - ppre);
            const cur = info.maxBackSpacing;
            info.maxBackSpacing = Math.max(cur, spacing);
        }
        if(pcur == ppre)
            info.resonant++;
    }
}

initWorker(SequenceGenerator);