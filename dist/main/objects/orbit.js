export class Orbit {
    constructor(data, attractor, config, anglesToRad = true) {
        this.attractor = attractor;
        this.config = config;
        this.semiMajorAxis = data.semiMajorAxis;
        this.eccentricity = data.eccentricity;
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
    solveTrueAnomalyAtDate(meanAnomaly0, epoch, date) {
        const e = this.eccentricity;
        const deltaTime = date - epoch;
        const M = meanAnomaly0 + this.meanMotion * deltaTime;
        const newton = (f, df) => {
            let n = 0;
            let prevX = M;
            let x = M - f(M) / df(M);
            while (Math.abs(x - prevX) > 1e-15 && n < 1000) {
                prevX = x;
                x -= f(x) / df(x);
                n++;
            }
            return x;
        };
        if (this.eccentricity < 1) {
            const E = newton(x => x - e * Math.sin(x) - M, x => 1 - e * Math.cos(x));
            return 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E * 0.5));
        }
        else {
            const H = newton(x => e * Math.sinh(x) - x - M, x => e * Math.cosh(x) - 1);
            return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H * 0.5));
        }
    }
    positionFromTrueAnomaly(trueAnomaly) {
        const pos = this.periapsisDir.clone();
        pos.applyAxisAngle(this.normal, trueAnomaly);
        pos.multiplyScalar(this.radius(trueAnomaly));
        return pos;
    }
    velocityFromTrueAnomaly(trueAnomaly) {
        const e = this.eccentricity;
        const mu = this.attractor.stdGravParam;
        const nu = trueAnomaly;
        const a = this.semiMajorAxis;
        const r = this.radius(nu);
        const vel = new THREE.Vector3();
        if (e < 1) {
            const v = Math.sqrt(mu * a) / r;
            const E = 2 * Math.atan(Math.tan(nu * 0.5) * Math.sqrt((1 - e) / (1 + e)));
            vel.set(-v * Math.sin(E), 0, -v * Math.sqrt(1 - e * e) * Math.cos(E));
        }
        else {
            const v = Math.sqrt(-mu * a) / r;
            const H = 2 * Math.atanh(Math.tan(nu * 0.5) * Math.sqrt((e - 1) / (e + 1)));
            vel.set(-v * Math.sinh(H), 0, -v * Math.sqrt(e * e - 1) * Math.cosh(H));
        }
        const right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
        const ascNodeDir = right.clone();
        ascNodeDir.applyAxisAngle(up, this.ascNodeLongitude);
        vel.applyAxisAngle(up, this.ascNodeLongitude);
        vel.applyAxisAngle(up, this.argOfPeriapsis);
        vel.applyAxisAngle(ascNodeDir, this.inclination);
        return vel;
    }
    radius(trueAnomaly) {
        return this.orbitalParam / (1 + this.eccentricity * Math.cos(trueAnomaly));
    }
    stateAtDate(meanAnomaly0, epoch, date) {
        const nu = this.solveTrueAnomalyAtDate(meanAnomaly0, epoch, date);
        const pos = this.positionFromTrueAnomaly(nu);
        const vel = this.velocityFromTrueAnomaly(nu);
        return { pos, vel };
    }
}
