export class IntegerInput {
    public readonly element!:   HTMLInputElement;
    private min!:       number;
    private max!:       number;
    
    constructor(id: string) {
        this.element = document.getElementById(id) as HTMLInputElement;
        this.min = parseInt(this.element.min);
        this.max = parseInt(this.element.max);

        this.element.onchange = () => this.validate();
    }

    public get value(){
        return parseInt(this.element.value);
    }

    public set value(num: number) {
        this.element.value = num.toString();
    }

    public validate() {
        let num = parseInt(this.element.value);
        if(!isNaN(num)) {
            num = this._clamp(num);
            this.element.value = num.toString();
            return true;
        }
        return false;
    }

    private _clamp(num: number){
        if(!isNaN(this.min) && !isNaN(this.max))
            return THREE.MathUtils.clamp(num, this.min, this.max);
        return num;
    }

    public assertValidity() {
        if(!this.validate())
            throw "Invalid numeric input.";
    }

    public setMinMax(min: number, max: number){
        this.min = min;
        this.max = max;
        this.value = this._clamp(this.value);
    }
}