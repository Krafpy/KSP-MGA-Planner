import { Orbit } from "./orbit.js";

export class CelestialBody implements ICelestialBody {
    readonly id!:           number;
    readonly name!:         string;
    readonly radius!:       number;
    readonly mass!:         number;
    readonly stdGravParam!: number;
    readonly soi!:          number;
    readonly color!:        number;
    readonly orbiters:      OrbitingBody[] = [];

    constructor(data: ICelestialBody){
        this.id             = data.id;
        this.name           = data.name;
        this.radius         = data.radius;
        this.mass           = data.mass;
        this.stdGravParam   = data.stdGravParam;
        this.soi            = data.soi;
        this.color          = data.color;
    }

    public get data() : ICelestialBody {
        return {
            id:             this.id,
            name:           this.name,
            radius:         this.radius,
            mass:           this.mass,
            stdGravParam:   this.stdGravParam,
            soi:            this.soi,
            color:          this.color
        }
    }
}

export class OrbitingBody extends CelestialBody implements IOrbitingBody {
    readonly meanAnomaly0!: number;
    readonly orbiting!:     number;
    readonly orbit!:        Orbit;
    readonly circularVel!:  number;

    constructor(data: IOrbitingBody, public readonly attractor: CelestialBody, config: OrbitSettings){
        super(data);
        
        this.orbit        = new Orbit(data.orbit, this.attractor, config);
        this.meanAnomaly0 = data.meanAnomaly0;
        this.orbiting     = data.orbiting;
        
        // Calculate orbital velocity considering a circular orbit
        const {stdGravParam}  = this.attractor;
        const {semiMajorAxis} = this.orbit;
        this.circularVel = Math.sqrt(stdGravParam / semiMajorAxis);
    }

    public get data(): IOrbitingBody {
        return {
            ...super.data,
            meanAnomaly0:   this.meanAnomaly0,
            orbiting:       this.orbiting,
            circularVel:    this.circularVel,
            orbit:          this.orbit.data
        };
    }
    
    /**
     * @param date The date (in seconds) from UT
     * @returns The true anomaly of the body at the specified date.
     */
    public trueAnomalyAtDate(date: number){
        return this.orbit.solveTrueAnomalyAtDate(this.meanAnomaly0, date);
    }

    /**
     * @param date The date (in seconds) from UT 0
     * @returns The real cartesian coordinates in space of the 
     * body at the specified date.
     */
    public positionAtDate(date: number){
        const anomaly = this.trueAnomalyAtDate(date);
        return this.orbit.positionFromTrueAnomaly(anomaly);
    }
}