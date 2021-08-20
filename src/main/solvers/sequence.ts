import { OrbitingBody } from "../objects/body";
import { SolarSystem } from "../objects/system";

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

        const getSubstr = (i: number) => this.bodies[i].name.substring(0, 2);
        let str = getSubstr(0);
        for(let i = 1; i < this.length; i++){
            str += "-" + getSubstr(i);
        }
        this.seqString = str;
    }

    static fromString(str: string, system: SolarSystem){
        str = str.trim();
        const initials = str.split('-');
        const ids: number[] = [];

        let attractor = 0;

        for(let i = 0; i < initials.length; i++){
            let valid = false;
            for(const body of system.orbiting){
                if(body.name.substring(0, 2) == initials[i]){
                    if(i == 0) {
                        attractor = body.attractor.id;
                    } else if(body.attractor.id != attractor) {
                        throw "All bodies of the sequence must orbit around the same body.";
                    }
                    ids.push(body.id);
                    valid = true;
                    break;
                }
            }
            if(!valid){
                throw "Invalid custom sequence input.";
            }
        }

        if(ids.length <= 1){
            throw "The sequence must contain at least two bodies.";
        }

        return new FlybySequence(system, ids);
    }
}