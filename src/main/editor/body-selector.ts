import { SolarSystem } from "../objects/system.js";
import { OrbitingBody } from "../objects/body.js";
import { Selector } from "./selector.js";

export class BodySelector extends Selector {
    constructor(id: string, public readonly system: SolarSystem) {
        super(id);
        this.fill();
    }

    public override fill(){
        fillSelectorWithBodies(this._selector, this.system.sun.orbiters);
    }
    
    public get body(){
        const bodyName = this.selected;
        const body = this.system.bodyFromName(bodyName) as OrbitingBody;
        if(!body)
            throw new Error("Invalid body selection.");
        return body;
    }
}

function fillSelectorWithBodies(selector: HTMLSelectElement | HTMLOptGroupElement, bodies: OrbitingBody[]) {
    for(const body of bodies) {
        appendBodyOption(body, selector);
        const hasOrbiters = body.orbiters.length > 0;
        if(hasOrbiters) {
            const optGroup = createSatelliteOptGroup(body, selector);
            fillSelectorWithBodies(optGroup, body.orbiters);
        }
    }
}

function appendBodyOption(body: OrbitingBody, selector: HTMLSelectElement | HTMLOptGroupElement) {
    const option = document.createElement("option");
    option.innerHTML = body.name;
    selector.appendChild(option);
}

function createSatelliteOptGroup(body: OrbitingBody, selector: HTMLSelectElement | HTMLOptGroupElement) {
    const optGroup = document.createElement("optgroup");
    optGroup.label = `${body.name}'s moons:`;
    selector.appendChild(optGroup);
    return optGroup;
}