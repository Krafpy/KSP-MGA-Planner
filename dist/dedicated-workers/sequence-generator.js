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
        this._toHigherOrbit = params.destinationId > params.departureId;
        this._getRelativePositions();
        const feasible = this._generateFeasibleSet();
        sendResult(feasible);
    }
    _generateFeasibleSet() {
        let incFeasibleSet = [{
                sequence: [this._params.departureId],
                resonant: 0,
                backLegs: 0,
                maxBackSpacing: 0
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
                        maxBackSpacing: incSeq.maxBackSpacing
                    };
                    this._updateSequenceInfo(tempSeq);
                    if (this._isSequenceValid(tempSeq)) {
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
    _isSequenceValid(info) {
        const params = this._params;
        const numSwingBys = info.sequence.length - 2;
        if (numSwingBys > params.maxSwingBys)
            return false;
        if (info.resonant > params.maxResonant)
            return false;
        if (info.backLegs > params.maxBackLegs)
            return false;
        return info.maxBackSpacing <= params.maxBackSpacing;
    }
    _updateSequenceInfo(info) {
        const { sequence } = info;
        const len = sequence.length;
        const pcur = this._relativePos[sequence[len - 1]];
        const ppre = this._relativePos[sequence[len - 2]];
        const toHO = this._toHigherOrbit;
        if ((toHO && pcur < ppre) || (!toHO && pcur > ppre)) {
            info.backLegs++;
            const spacing = Math.abs(pcur - ppre);
            const cur = info.maxBackSpacing;
            info.maxBackSpacing = Math.max(cur, spacing);
        }
        if (pcur == ppre)
            info.resonant++;
    }
}
WorkerEnvironment.init(SequenceGenerator);
