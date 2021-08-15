export class Selector {
    protected readonly _selector: HTMLSelectElement;
    protected _onChange!: (value: string, index: number) => void;

    constructor(id: string) {
        this._selector = document.getElementById(id) as HTMLSelectElement;
    }

    public fill(options: string[]){
        this.clear();
        for(const option of options) {
            appendOption(this._selector, option);
        }
    }

    public clear(){
        this._selector.innerHTML = "";
    }

    public change(onChange: (value: string, index: number) => void){
        this._onChange = onChange;
        this._selector.onchange = () => {
            const index = this._selector.selectedIndex;
            const value = this._selector.value;
            this._onChange(value, index);
        }
    }

    public select(index: number){
        this._selector.selectedIndex = index;
        if(this._onChange)
            this._onChange(this._selector.value, this._selector.selectedIndex);
        return this._selector.value;
    }

    public get selected(){
        return this._selector.value;
    }

    public enable(){
        this._selector.disabled = false;
    }

    public disable(){
        this._selector.disabled = true;
    }
}

function appendOption(selector: HTMLSelectElement | HTMLOptGroupElement, option: string){
    const optionElt = document.createElement("option");
    optionElt.innerHTML = option;
    selector.appendChild(optionElt);
}