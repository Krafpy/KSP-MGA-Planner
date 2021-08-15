export class ProgressMessage {
    private readonly _paragraph!: HTMLParagraphElement;
    private _displayTimeout!:    number;

    constructor(id: string) {
        this._paragraph = document.getElementById(id) as HTMLParagraphElement;
    }

    enable(timeout: number){
        if(this._displayTimeout) clearTimeout(this._displayTimeout);
        this._displayTimeout = setTimeout(() => this._paragraph.hidden = false, timeout);
    }

    hide() {
        clearTimeout(this._displayTimeout);
        this._paragraph.hidden = true;
    }

    setMessage(msg: string){
        this._paragraph.innerHTML = msg;
    }
}