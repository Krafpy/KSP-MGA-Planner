export class TextareaLogger {
    static log(msg) {
        this.textarea.textContent += this.toString(msg);
        this.textarea.scrollTop = this.textarea.scrollHeight;
        console.log(msg);
    }
    static error(msg) {
        this.textarea.textContent += "\nERROR: " + this.toString(msg);
        this.textarea.scrollTop = this.textarea.scrollHeight;
        console.error(msg);
    }
    static clear() {
        this.textarea.textContent = "";
    }
    static toString(msg) {
        if (typeof msg == 'object') {
            if (msg.hasOwnProperty("message"))
                return msg.message;
            return (JSON && JSON.stringify ? JSON.stringify(msg) : msg) + "\n";
        }
        else {
            return msg + "\n";
        }
    }
}
