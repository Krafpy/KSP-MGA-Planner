export class Button {
    protected readonly _btn!: HTMLButtonElement;

    constructor(id: string) {
        this._btn = document.getElementById(id) as HTMLButtonElement;
    }

    public enable(){
        this._btn.disabled = false;
    }

    public disable(){
        this._btn.disabled = true;
    }

    click(action: () => void){
        this._btn.onclick = action;
    }
}