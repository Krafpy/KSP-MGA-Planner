"use strict";
{
    importScripts("libs/common.js");
    let config;
    onWorkerInitialize = data => config = data;
    onWorkerRun = input => {
        const { bodies, params } = input;
        const feasible = generateFeasibleSet(bodies, params);
        sendResult(feasible);
    };
    function generateFeasibleSet(allowedBodies, params) {
        let incFeasibleSet = [{
                sequence: [params.departureId],
                resonant: 0,
                backLegs: 0
            }];
        let tempSet = [];
        const feasibleSet = [];
        const relativePos = getRelativePositions(allowedBodies);
        const feasible = (seq) => checkSequenceFeasibility(seq, relativePos, params);
        const { maxEvalSequences } = config.flybySequence;
        outerloop: while (incFeasibleSet.length > 0) {
            for (const incSeq of incFeasibleSet) {
                for (const bodyId of allowedBodies) {
                    const tempSeq = {
                        sequence: [...incSeq.sequence, bodyId],
                        resonant: incSeq.resonant,
                        backLegs: incSeq.backLegs
                    };
                    if (feasible(tempSeq)) {
                        if (bodyId == params.destinationId) {
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
    function getRelativePositions(allowedBodies) {
        const relativePos = new Map();
        for (let i = 0; i < allowedBodies.length; ++i) {
            relativePos.set(allowedBodies[i], i);
        }
        return relativePos;
    }
    function checkSequenceFeasibility(seq, relativePos, params) {
        const numSwingBys = seq.sequence.length - 2;
        if (numSwingBys > params.maxSwingBys)
            return false;
        const posCurr = relativePos.get(seq.sequence[seq.sequence.length - 1]);
        const posPrev = relativePos.get(seq.sequence[seq.sequence.length - 2]);
        const toHigherOrbit = params.destinationId > params.departureId;
        if (isBackLeg(posCurr, posPrev, toHigherOrbit)) {
            const jumpSpacing = Math.abs(posPrev - posCurr);
            if (jumpSpacing > params.maxBackSpacing)
                return false;
            seq.backLegs++;
        }
        if (posCurr == posPrev)
            seq.resonant++;
        return seq.resonant <= params.maxResonant && seq.backLegs <= params.maxBackLegs;
    }
    function isBackLeg(posCurr, posPrev, toHigherOrbit) {
        return (toHigherOrbit && posCurr < posPrev) || (!toHigherOrbit && posCurr > posPrev);
    }
}
