export class DraggableTextbox {
    private static nextId = 0;
    private static startZ = 9;
    private static boxes = new Map<string, HTMLDivElement>();

    public static create(title: string, content: string){
        const template = document.getElementById("draggable-text-template") as HTMLDivElement;
        const div = template.cloneNode(true) as HTMLDivElement;
        document.body.insertBefore(div,document.body.lastChild);
        div.id = `draggable-text-${this.nextId}`;
        this.nextId++;
        this.boxes.set(div.id, div);

        const header = div.getElementsByClassName("draggable-text-header")[0] as HTMLDivElement;
        const h = header.getElementsByClassName("draggable-text-title")[0] as HTMLTitleElement;
        h.innerHTML = title;

        const textarea = div.getElementsByTagName("textarea")[0] as HTMLTextAreaElement;
        textarea.value = content;

        const closeBtn = div.getElementsByClassName("draggable-close-btn")[0] as HTMLButtonElement;
        closeBtn.onclick = () => div.remove();
        const copyBtn = div.getElementsByClassName("draggable-copy-btn")[0] as HTMLButtonElement;
        copyBtn.onclick = () => navigator.clipboard.writeText(content);

        // from: https://www.w3schools.com/howto/howto_js_draggable.asp
        let pos1: number, pos2: number, pos3: number, pos4: number;
        const dragMouseDown = (e: any) => {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;

            this.moveToFront(div.id);
        }
    
        const elementDrag = (e: any) => {
            e = e || window.event;
            e.preventDefault();
            // calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // set the element's new position:
            div.style.top = (div.offsetTop - pos2) + "px";
            div.style.left = (div.offsetLeft - pos1) + "px";
        }
    
        const closeDragElement = () => {
            // stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }

        header.onmousedown = dragMouseDown;
        this.moveToFront(div.id);
        this.startZ++;

        div.hidden = false;
        div.style.display = "";
    }

    private static moveToFront(id: string){
        const div0 = this.boxes.get(id) as HTMLDivElement;
        const z0 = parseInt(div0.style.zIndex);
        this.boxes.forEach((div, _) => {
            const z = parseInt(div.style.zIndex);
            if(z > z0){
                div.style.zIndex = (z-1).toString();
            }
        });
        div0.style.zIndex = this.startZ.toString();
    }
}