import { Orbit } from "./orbit.js";
export class CelestialBody {
    constructor(data) {
        this.orbiters = [];
        this.id = data.id;
        this.name = data.name;
        this.radius = data.radius;
        this.mass = data.mass;
        this.stdGravParam = data.stdGravParam;
        this.soi = data.soi;
        this.color = data.color;
    }
    get data() {
        return {
            id: this.id,
            name: this.name,
            radius: this.radius,
            mass: this.mass,
            stdGravParam: this.stdGravParam,
            soi: this.soi,
            color: this.color
        };
    }
}
export class OrbitingBody extends CelestialBody {
    constructor(data, attractor, config) {
        super(data);
        this.attractor = attractor;
        this.orbit = new Orbit(data.orbit, this.attractor, config);
        this.meanAnomaly0 = data.meanAnomaly0;
        this.epoch = data.epoch;
        this.orbiting = data.orbiting;
        const { stdGravParam } = this.attractor;
        const { semiMajorAxis } = this.orbit;
        this.circularVel = Math.sqrt(stdGravParam / semiMajorAxis);
    }
    get data() {
        return {
            ...super.data,
            meanAnomaly0: this.meanAnomaly0,
            epoch: this.epoch,
            orbiting: this.orbiting,
            circularVel: this.circularVel,
            orbit: this.orbit.data
        };
    }
    trueAnomalyAtDate(date) {
        return this.orbit.solveTrueAnomalyAtDate(this.meanAnomaly0, this.epoch, date);
    }
    positionAtDate(date) {
        const anomaly = this.trueAnomalyAtDate(date);
        return this.orbit.positionFromTrueAnomaly(anomaly);
    }
}
