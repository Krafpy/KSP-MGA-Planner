class Button {
    constructor(id) {
        this._btn = document.getElementById(id);
    }
    enable() {
        this._btn.disabled = false;
    }
    disable() {
        this._btn.disabled = true;
    }
}
export class SubmitButton extends Button {
    constructor(id) {
        super(id);
    }
    click(asyncAction) {
        this._btn.onclick = async () => {
            this.disable();
            await asyncAction();
            this.enable();
        };
    }
}
export class StopButton extends Button {
    constructor(id) {
        super(id);
    }
    click(action) {
        this._btn.onclick = () => action();
    }
}
