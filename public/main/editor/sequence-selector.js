import { Selector } from "./selector.js";
export class SequenceSelector extends Selector {
    constructor(id) {
        super(id);
        this.sequences = [];
    }
    fillFrom(sequences) {
        this.sequences = sequences;
        const strs = this.sequences.map(seq => seq.seqString);
        this.fill(strs);
    }
    get sequence() {
        const selectedString = this._selector.value;
        for (const sequence of this.sequences) {
            if (sequence.seqString == selectedString)
                return sequence;
        }
        throw "Invalid sequence selection.";
    }
}
