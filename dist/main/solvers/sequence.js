import { joinStrings } from "../utilities/array.js";
export class FlybySequence {
    constructor(system, ids) {
        this.ids = ids;
        this.bodies = [];
        for (const id of ids) {
            this.bodies.push(system.bodyFromId(id));
        }
        this.length = this.bodies.length;
        const initials = this.bodies.map((body) => body.name.substring(0, 2));
        this.seqString = joinStrings(initials, "-");
    }
    get seqStringFullNames() {
        const names = this.bodies.map((body) => body.name);
        return joinStrings(names, "-");
    }
    static fromString(str, system) {
        str = str.trim();
        const initialsList = str.split('-').map(s => s.trim());
        const ids = [];
        let attractorId = 0;
        for (let i = 0; i < initialsList.length; i++) {
            const initials = initialsList[i];
            if (initials.length < 2)
                throw new Error("Body sequence initials must contain at least 2 characters.");
            const bodiesWithInitials = [];
            for (const body of system.orbiting) {
                if (body.name.toLowerCase().startsWith(initials.toLowerCase())) {
                    bodiesWithInitials.push(body);
                }
            }
            if (bodiesWithInitials.length >= 2) {
                const bodyNames = bodiesWithInitials.map(body => body.name);
                throw new Error(`Ambiguous initials \"${initials}\": ${joinStrings(bodyNames, ", ")}.`);
            }
            if (bodiesWithInitials.length == 0)
                throw new Error(`Invalid custom sequence body initials \"${initials}\".`);
            const body = bodiesWithInitials[0];
            if (i == 0) {
                attractorId = body.attractor.id;
            }
            else if (body.attractor.id != attractorId) {
                throw new Error("All bodies of the sequence must orbit around the same body.");
            }
            ids.push(body.id);
        }
        if (ids.length <= 1) {
            throw new Error("The sequence must contain at least two bodies.");
        }
        return new FlybySequence(system, ids);
    }
}
