export class ProgressMessage {
    constructor(id) {
        this._paragraph = document.getElementById(id);
    }
    enable(timeout) {
        if (this._displayTimeout)
            clearTimeout(this._displayTimeout);
        this._displayTimeout = setTimeout(() => this._paragraph.hidden = false, timeout);
    }
    hide() {
        clearTimeout(this._displayTimeout);
        this._paragraph.hidden = true;
    }
    setMessage(msg) {
        this._paragraph.innerHTML = msg;
    }
}
