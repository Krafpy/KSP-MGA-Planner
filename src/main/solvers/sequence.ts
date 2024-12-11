import { OrbitingBody } from "../objects/body.js";
import { SolarSystem } from "../objects/system.js";
import { joinStrings } from "../utilities/array.js";

export class FlybySequence {
    public readonly bodies!:    OrbitingBody[];
    public readonly length!:    number;
    public readonly seqString!: string;
    
    constructor(system: SolarSystem, public readonly ids: number[]) {
        this.bodies = [];
        for(const id of ids){
            this.bodies.push(system.bodyFromId(id) as OrbitingBody);
        }
        this.length = this.bodies.length;

        const initials = this.bodies.map((body: OrbitingBody) => body.name.substring(0, 2));
        this.seqString = joinStrings(initials, "-");
    }

    get seqStringFullNames(){
        const names = this.bodies.map((body: OrbitingBody) => body.name);
        return joinStrings(names, "-");
    }

    static fromString(str: string, system: SolarSystem){
        str = str.trim();
        const initialsList = str.split('-').map(s => s.trim());

        const ids: number[] = [];
        let attractorId = 0;

        for(let i = 0; i < initialsList.length; i++) {
            const initials = initialsList[i];

            // at least 2 characters
            if (initials.length < 2)
                throw new Error("Body sequence initials must contain at least 2 characters.");
            
            // check for ambiguity and validity
            const bodiesWithInitials: OrbitingBody[] = [];
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
            // check for same attractor
            if (i == 0) {
                attractorId = body.attractor.id;
            } else if (body.attractor.id != attractorId) {
                throw new Error("All bodies of the sequence must orbit around the same body.");
            }

            ids.push(body.id);
        }

        if(ids.length <= 1){
            throw new Error("The sequence must contain at least two bodies.");
        }

        return new FlybySequence(system, ids);
    }
}