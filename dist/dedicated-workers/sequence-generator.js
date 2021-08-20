"use strict";
importScripts("libs/common.js");
class SequenceGenerator extends WorkerEnvironment {
    onWorkerInitialize(data) {
        this._config = data;
    }
    onWorkerRun(input) {
        const { bodies, params } = input;
        this._bodies = bodies;
        this._params = params;
        this._getRelativePositions();
        const feasible = this._generateFeasibleSet();
        sendResult(feasible);
    }
    _generateFeasibleSet() {
        let incFeasibleSet = [{
                sequence: [this._params.departureId],
                resonant: 0,
                backLegs: 0,
                backSpacingExceeded: false
            }];
        let tempSet = [];
        const feasibleSet = [];
        const { maxEvalSequences } = this._config.flybySequence;
        outerloop: while (incFeasibleSet.length > 0) {
            for (const incSeq of incFeasibleSet) {
                for (const bodyId of this._bodies) {
                    const tempSeq = {
                        sequence: [...incSeq.sequence, bodyId],
                        resonant: incSeq.resonant,
                        backLegs: incSeq.backLegs,
                        backSpacingExceeded: false
                    };
                    this._updateSequenceInfo(tempSeq);
                    if (this._isSequenceFeasible(tempSeq)) {
                        if (bodyId == this._params.destinationId) {
                            feasibleSet.push(tempSeq.sequence);
                            if (feasibleSet.length >= maxEvalSequences)
                                break outerloop;
                        }
                        else {
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
    _getRelativePositions() {
        const maxId = Math.max(...this._bodies);
        const relativePos = Array(maxId + 1).fill(0);
        for (let i = 0; i < this._bodies.length; ++i) {
            relativePos[this._bodies[i]] = i;
        }
        this._relativePos = relativePos;
    }
    _isSequenceFeasible(info) {
        const params = this._params;
        const numSwingBys = info.sequence.length - 2;
        if (numSwingBys > params.maxSwingBys)
            return false;
        const resonancesOk = info.resonant <= this._params.maxResonant;
        const backLegsOk = info.backLegs <= this._params.maxBackLegs;
        return resonancesOk && backLegsOk && !info.backSpacingExceeded;
    }
    _updateSequenceInfo(info) {
        const params = this._params;
        const { sequence } = info;
        const posCurr = this._relativePos[sequence[sequence.length - 1]];
        const posPrev = this._relativePos[sequence[sequence.length - 2]];
        const toHigherOrbit = params.destinationId > params.departureId;
        const isBackLeg = (toHigherOrbit && posCurr < posPrev) || (!toHigherOrbit && posCurr > posPrev);
        const spacing = Math.abs(posCurr - posPrev);
        info.backSpacingExceeded = isBackLeg && spacing > params.maxBackSpacing;
        if (isBackLeg)
            info.backLegs++;
        if (posCurr == posPrev)
            info.resonant++;
    }
}
initWorker(SequenceGenerator);
