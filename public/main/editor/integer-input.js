export class IntegerInput {
    constructor(id) {
        this.element = document.getElementById(id);
        this.min = parseInt(this.element.min);
        this.max = parseInt(this.element.max);
        this.element.onchange = () => this.validate();
    }
    get value() {
        return parseInt(this.element.value);
    }
    set value(num) {
        this.element.value = num.toString();
    }
    validate() {
        let num = parseInt(this.element.value);
        if (!isNaN(num)) {
            num = this._clamp(num);
            this.element.value = num.toString();
            return true;
        }
        return false;
    }
    _clamp(num) {
        if (!isNaN(this.min) && !isNaN(this.max))
            return THREE.MathUtils.clamp(num, this.min, this.max);
        return num;
    }
    assertValidity() {
        if (!this.validate())
            throw "Invalid numeric input.";
    }
    setMinMax(min, max) {
        this.min = min;
        this.max = max;
        this.value = this._clamp(this.value);
    }
}
