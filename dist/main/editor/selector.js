export class Selector {
    constructor(id) {
        this._selector = document.getElementById(id);
    }
    fill(options) {
        this.clear();
        for (const option of options) {
            appendOption(this._selector, option);
        }
    }
    clear() {
        this._selector.innerHTML = "";
    }
    change(onChange) {
        this._onChange = onChange;
        this._selector.onchange = () => {
            const index = this._selector.selectedIndex;
            const value = this._selector.value;
            this._onChange(value, index);
        };
    }
    select(index) {
        this._selector.selectedIndex = index;
        if (this._onChange)
            this._onChange(this._selector.value, this._selector.selectedIndex);
        return this._selector.value;
    }
    get selected() {
        return this._selector.value;
    }
    enable() {
        this._selector.disabled = false;
    }
    disable() {
        this._selector.disabled = true;
    }
}
function appendOption(selector, option) {
    const optionElt = document.createElement("option");
    optionElt.innerHTML = option;
    selector.appendChild(optionElt);
}
