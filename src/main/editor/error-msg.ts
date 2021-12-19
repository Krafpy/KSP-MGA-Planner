export class ErrorMessage {
    readonly paragraph!: HTMLParagraphElement;
    readonly span!:      HTMLSpanElement;

    constructor(id: string){
        this.paragraph = document.getElementById(id) as HTMLParagraphElement;
        this.span = this.paragraph.getElementsByTagName("SPAN")[0] as HTMLSpanElement;
        this.hide();
    }

    hide(){
        this.paragraph.hidden = true;
    }

    show(msg: Error){
        this.span.innerHTML = msg.message;
        this.paragraph.hidden = false;
    }
}
