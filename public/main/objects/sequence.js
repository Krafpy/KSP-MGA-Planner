export class FlybySequence {
    constructor(system, ids, cost) {
        this.ids = ids;
        this.cost = cost;
        this.bodies = [];
        for (const id of ids) {
            this.bodies.push(system.bodyFromId(id));
        }
        this.length = this.bodies.length;
        const getSubstr = (i) => this.bodies[i].name.substring(0, 2);
        let str = getSubstr(0);
        for (let i = 1; i < this.length; i++) {
            str += "-" + getSubstr(i);
        }
        this.seqString = str;
    }
}
