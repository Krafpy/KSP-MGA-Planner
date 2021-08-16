import { OrbitingBody } from "../objects/body";
import { SolarSystem } from "../objects/system";

export class FlybySequence {
    public readonly bodies!:    OrbitingBody[];
    public readonly length!:    number;
    public readonly seqString!: string;
    
    constructor(system: SolarSystem, public readonly ids: number[], public readonly cost: number) {
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
}