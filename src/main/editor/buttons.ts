class Button {
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
}

export class SubmitButton extends Button {
    constructor(id: string) {
        super(id);
    }

    click(asyncAction: () => Promise<void>){
        this._btn.onclick = async () => {
            this.disable();
            await asyncAction();
            this.enable();
        };
    }
}

export class StopButton extends Button {
    constructor(id: string) {
        super(id);
    }

    click(action: () => void){
        this._btn.onclick = () => action();
    }
}