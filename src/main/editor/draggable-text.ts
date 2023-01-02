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

        let x: number, y: number;
        header.onmousedown = (e: MouseEvent) => {
            e = e || window.event;
            e.preventDefault();

            x = e.clientX;
            y = e.clientY;

            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };

            document.onmousemove = (e: MouseEvent) => {
                e = e || window.event;
                e.preventDefault();

                let dx = x - e.clientX;
                let dy = y - e.clientY;
                x = e.clientX;
                y = e.clientY;

                let left = div.offsetLeft - dx;
                let top = div.offsetTop - dy;
                div.style.top = top.toString() + "px";
                div.style.left = left.toString() + "px";
            };

            this.moveToFront(id);
        };

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