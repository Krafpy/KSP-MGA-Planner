import { Selector } from "./selector.js";
export class BodySelector extends Selector {
    constructor(id, system) {
        super(id);
        this.system = system;
        this.fill();
    }
    fill() {
        fillSelectorWithBodies(this._selector, this.system.sun.orbiters);
    }
    get body() {
        const bodyName = this.selected;
        const body = this.system.bodyFromName(bodyName);
        if (!body)
            throw new Error("Invalid body selection.");
        return body;
    }
}
function fillSelectorWithBodies(selector, bodies) {
    for (const body of bodies) {
        appendBodyOption(body, selector);
        const hasOrbiters = body.orbiters.length > 0;
        if (hasOrbiters) {
            const optGroup = createSatelliteOptGroup(body, selector);
            fillSelectorWithBodies(optGroup, body.orbiters);
        }
    }
}
function appendBodyOption(body, selector) {
    const option = document.createElement("option");
    option.innerHTML = body.name;
    selector.appendChild(option);
}
function createSatelliteOptGroup(body, selector) {
    const optGroup = document.createElement("optgroup");
    optGroup.label = `${body.name}'s moons:`;
    selector.appendChild(optGroup);
    return optGroup;
}
