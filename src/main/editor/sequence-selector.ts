import { FlybySequence } from "../solvers/sequence.js";
import { Selector } from "./selector.js";

export class SequenceSelector extends Selector {
    public sequences: FlybySequence[] = [];

    constructor(id: string){
        super(id);
    }

    public fillFrom(sequences: FlybySequence[]){
        this.sequences = sequences;
        const strs = this.sequences.map(seq => seq.seqString);
        this.fill(strs);
    }

    public get sequence(){
        const selectedString = this._selector.value;
        for(const sequence of this.sequences) {
            if(sequence.seqString == selectedString)
                return sequence;
        }
        throw "Invalid sequence selection.";
    }
}