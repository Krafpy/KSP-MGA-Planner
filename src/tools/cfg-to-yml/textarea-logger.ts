export class TextareaLogger
{
    public static textarea: HTMLTextAreaElement
    
    public static log(msg: any)
    {
        this.textarea.textContent += this.toString(msg);
        this.textarea.scrollTop = this.textarea.scrollHeight;
        console.log(msg);
    }

    public static error(msg: any)
    {
        this.textarea.textContent += "\nERROR: " + this.toString(msg);
        this.textarea.scrollTop = this.textarea.scrollHeight;
        console.error(msg);
    }

    public static clear()
    {
        this.textarea.textContent = "";
    }

    private static toString(msg: any)
    {
        if (typeof msg == 'object') {
            if(msg.hasOwnProperty("message"))
                return msg.message;
            return (JSON && JSON.stringify ? JSON.stringify(msg) : msg) + "\n";
        } else {
            return msg + "\n";
        }
    }
}