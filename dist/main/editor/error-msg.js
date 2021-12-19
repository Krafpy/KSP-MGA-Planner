export class ErrorMessage {
    constructor(id) {
        this.paragraph = document.getElementById(id);
        this.span = this.paragraph.getElementsByTagName("SPAN")[0];
        this.hide();
    }
    hide() {
        this.paragraph.hidden = true;
    }
    show(msg) {
        this.span.innerHTML = msg.message;
        this.paragraph.hidden = false;
    }
}
