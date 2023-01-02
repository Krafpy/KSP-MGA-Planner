export class DraggableTextbox {
    static create(title, content) {
        for (const [id, item] of this.boxes) {
            if (item.title == title) {
                this.moveToFront(id);
                return;
            }
        }
        const template = document.getElementById("draggable-text-template");
        const div = template.cloneNode(true);
        document.body.insertBefore(div, document.body.lastChild);
        const id = this.nextId;
        div.id = `draggable-text-${id}`;
        this.nextId++;
        this.boxes.set(id, { div, title });
        const header = div.getElementsByClassName("draggable-text-header")[0];
        const h = header.getElementsByClassName("draggable-text-title")[0];
        h.innerHTML = title;
        const textarea = div.getElementsByTagName("textarea")[0];
        textarea.value = content;
        const closeBtn = div.getElementsByClassName("draggable-close-btn")[0];
        closeBtn.onclick = () => {
            div.remove();
            this.boxes.delete(id);
        };
        const copyBtn = div.getElementsByClassName("draggable-copy-btn")[0];
        copyBtn.onclick = () => navigator.clipboard.writeText(content);
        let x, y;
        header.onmousedown = (e) => {
            e = e || window.event;
            e.preventDefault();
            x = e.clientX;
            y = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (e) => {
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
        return id;
    }
    static moveToFront(id) {
        const item = this.boxes.get(id);
        const div0 = item.div;
        const z0 = parseInt(div0.style.zIndex);
        this.boxes.forEach(({ div }, _) => {
            const z = parseInt(div.style.zIndex);
            if (z > z0) {
                div.style.zIndex = (z - 1).toString();
            }
        });
        div0.style.zIndex = this.startZ.toString();
    }
}
DraggableTextbox.nextId = 0;
DraggableTextbox.startZ = 9;
DraggableTextbox.boxes = new Map();
