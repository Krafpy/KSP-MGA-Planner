export class DraggableTextbox {
    private static nextId = 0;
    private static startZ = 9;
    private static boxes = new Map<number, {div: HTMLDivElement, title: string}>();

    public static create(title: string, content: string){
        for(const [id, item] of this.boxes){
            if(item.title == title) {
                this.moveToFront(id);
                return;
            }
        }

        const template = document.getElementById("draggable-text-template") as HTMLDivElement;
        const div = template.cloneNode(true) as HTMLDivElement;
        document.body.insertBefore(div,document.body.lastChild);
        const id = this.nextId;
        div.id = `draggable-text-${id}`;
        this.nextId++;
        this.boxes.set(id, {div, title});

        const header = div.getElementsByClassName("draggable-text-header")[0] as HTMLDivElement;
        const h = header.getElementsByClassName("draggable-text-title")[0] as HTMLTitleElement;
        h.innerHTML = title;

        const textarea = div.getElementsByTagName("textarea")[0] as HTMLTextAreaElement;
        textarea.value = content;

        const closeBtn = div.getElementsByClassName("draggable-close-btn")[0] as HTMLButtonElement;
        closeBtn.onclick = () => {
            div.remove();
            this.boxes.delete(id);
        };
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

            this.moveToFront(id);
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
            let top = (div.offsetTop - pos2);
            let left = (div.offsetLeft - pos1);
            div.style.top = top.toString() + "px";
            div.style.left = left.toString() + "px";
        }
    
        const closeDragElement = () => {
            // stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }

        header.onmousedown = dragMouseDown;

        textarea.onclick = () => this.moveToFront(id);

        this.moveToFront(id);
        this.startZ++;

        div.hidden = false;
        div.style.display = "";

        return id
    }

    public static moveToFront(id: number){
        const item = this.boxes.get(id) as {div: HTMLDivElement, title: string};
        const div0 = item.div;
        const z0 = parseInt(div0.style.zIndex);
        this.boxes.forEach(({div}, _) => {
            const z = parseInt(div.style.zIndex);
            if(z > z0){
                div.style.zIndex = (z-1).toString();
            }
        });
        div0.style.zIndex = this.startZ.toString();
    }
}