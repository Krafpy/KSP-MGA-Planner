export class Orbit {
    constructor(data, attractor, config, anglesToRad = true) {
        this.attractor = attractor;
        this.config = config;
        this.semiMajorAxis = data.semiMajorAxis;
        this.eccentricity = data.eccentricity;
        this.sideralPeriod = data.sideralPeriod ? data.sideralPeriod : undefined;
        this.orbitalParam = this.semiMajorAxis * (1 - this.eccentricity ** 2);
        this.meanMotion = Math.sqrt(this.attractor.stdGravParam / (Math.abs(this.semiMajorAxis) ** 3));
        if (this.eccentricity < 1) {
            this.periapsis = this.semiMajorAxis * (1 - this.eccentricity);
            this.apoapsis = 2 * this.semiMajorAxis - this.periapsis;
        }
        if (anglesToRad) {
            this.inclination = THREE.MathUtils.degToRad(data.inclination);
            this.argOfPeriapsis = THREE.MathUtils.degToRad(data.argOfPeriapsis);
            this.ascNodeLongitude = THREE.MathUtils.degToRad(data.ascNodeLongitude);
        }
        else {
            this.inclination = data.inclination;
            this.argOfPeriapsis = data.argOfPeriapsis;
            this.ascNodeLongitude = data.ascNodeLongitude;
        }
        this.ascNodeDir = new THREE.Vector3(1, 0, 0);
        this.ascNodeDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.ascNodeLongitude);
        this.normal = new THREE.Vector3(0, 1, 0);
        this.normal.applyAxisAngle(this.ascNodeDir, this.inclination);
        this.periapsisDir = this.ascNodeDir.clone();
        this.periapsisDir.applyAxisAngle(this.normal, this.argOfPeriapsis);
    }
    get data() {
        return {
            semiMajorAxis: this.semiMajorAxis,
            apoapsis: this.apoapsis,
            periapsis: this.periapsis,
            eccentricity: this.eccentricity,
            inclination: this.inclination,
            argOfPeriapsis: this.argOfPeriapsis,
            ascNodeLongitude: this.ascNodeLongitude,
            sideralPeriod: this.sideralPeriod,
            orbitalParam: this.orbitalParam,
            meanMotion: this.meanMotion
        };
    }
    static fromOrbitalElements(elements, attractor, config) {
        const data = {
            eccentricity: elements.eccentricity,
            semiMajorAxis: elements.semiMajorAxis,
            inclination: elements.inclination,
            ascNodeLongitude: elements.ascNodeLongitude,
            argOfPeriapsis: elements.argOfPeriapsis
        };
        return new Orbit(data, attractor, config, false);
    }
    solveTrueAnomalyAtDate(meanAnomaly0, date) {
        const e = this.eccentricity;
        const deltaTime = this.sideralPeriod ? (date % this.sideralPeriod) : date;
        const M = meanAnomaly0 + this.meanMotion * deltaTime;
        const newtonRootSolve = (f, df, x0, maxIters = 1000) => {
            let n = 0;
            let prevX = x0;
            let x = x0 - f(x0) / df(x0);
            while (Math.abs(x - prevX) > 1e-15 && n < maxIters) {
                prevX = x;
                x -= f(x) / df(x);
                n++;
            }
            return x;
        };
        if (this.eccentricity < 1) {
            const E = newtonRootSolve(x => x - e * Math.sin(x) - M, x => 1 - e * Math.cos(x), M);
            return 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E * 0.5));
        }
        else {
            const H = newtonRootSolve(x => e * Math.sinh(x) - x - M, x => e * Math.cosh(x) - 1, M);
            return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H * 0.5));
        }
    }
    positionFromTrueAnomaly(trueAnomaly) {
        const pos = this.periapsisDir.clone();
        pos.applyAxisAngle(this.normal, trueAnomaly);
        pos.multiplyScalar(this.radius(trueAnomaly));
        return pos;
    }
    radius(trueAnomaly) {
        return this.orbitalParam / (1 + this.eccentricity * Math.cos(trueAnomaly));
    }
}
