export class DiscreteRange {
    constructor(id) {
        this._rangeInput = document.getElementById(id);
        this._rangeInput.step = "1";
    }
    setMinMax(min, max) {
        this._rangeInput.min = min.toString();
        this._rangeInput.max = max.toString();
    }
    input(onInput) {
        this._rangeInput.oninput = () => onInput(this.value);
    }
    get value() {
        return parseInt(this._rangeInput.value);
    }
    set value(val) {
        this._rangeInput.value = val.toString();
    }
    disable() {
        this._rangeInput.disabled = true;
    }
    enable() {
        this._rangeInput.disabled = false;
    }
}
