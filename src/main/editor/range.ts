export class DiscreteRange {
    private readonly _rangeInput!: HTMLInputElement;

    constructor(id: string){
        this._rangeInput = document.getElementById(id) as HTMLInputElement;
        this._rangeInput.step = "1";
    }

    public setMinMax(min: number, max: number){
        this._rangeInput.min = min.toString();
        this._rangeInput.max = max.toString();
    }

    public input(onInput: (value: number) => void){
        this._rangeInput.oninput = () => onInput(this.value);
    }

    public get value(){
        return parseInt(this._rangeInput.value);
    }

    public set value(val: number){
        this._rangeInput.value = val.toString();
    }

    public disable(){
        this._rangeInput.disabled = true;
    }

    public enable(){
        this._rangeInput.disabled = false;
    }
}