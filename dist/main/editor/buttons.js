export class Button {
    constructor(id) {
        this._btn = document.getElementById(id);
    }
    enable() {
        this._btn.disabled = false;
    }
    disable() {
        this._btn.disabled = true;
    }
    click(action) {
        this._btn.onclick = action;
    }
}
