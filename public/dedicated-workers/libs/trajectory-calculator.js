"use strict";
class TrajectoryCalculator {
    constructor(system, config, sequence) {
        this.system = system;
        this.config = config;
        this.sequence = sequence;
        this.steps = [];
        this._legs = [];
        this.totalDeltaV = 0;
        this._missionTime = 0;
        this._sequenceIndex = 0;
        this._departureDate = 0;
        this._departureDVScale = 0;
        const attractorId = this._departureBody.orbiting;
        this._mainAttractor = this.system[attractorId];
    }
    setParameters(depAltitude, startDateMin, startDateMax, params) {
        this.depAltitude = depAltitude;
        this.startDateMin = startDateMin;
        this.startDateMax = startDateMax;
        this.params = params;
        this._getDepartureInfo();
        this._clampDepartureInfos();
        this._getLegsInfo();
    }
    compute() {
        this.noError = false;
        this._missionTime = this._departureDate;
        this._calculateParkingOrbit();
        this._calculateEjectionOrbit();
        this._missionTime += this._lastStep.duration;
        for (let i = 1; i < this.sequence.length; i++) {
            this._sequenceIndex = i;
            const leg = this._legs[i - 1];
            if (!this._calculateLegFirstArc()) {
                return;
            }
            this._calculateLegSecondArc();
            this._updateLegInfos(i - 1);
            this._missionTime += leg.duration;
            this._calculateFlybyTrajectory();
            this._missionTime += this._lastStep.duration;
        }
        this.noError = true;
    }
    get _destinationBody() {
        const id = this.sequence[this.sequence.length - 1];
        return this.system[id];
    }
    get _departureBody() {
        return this.system[this.sequence[0]];
    }
    get _attractorMu() {
        return this._mainAttractor.stdGravParam;
    }
    get _lastStep() {
        return this.steps[this.steps.length - 1];
    }
    get _lastStepDateOfEnd() {
        const { dateOfStart, duration } = this._lastStep;
        return dateOfStart + duration;
    }
    _getDepartureInfo() {
        this._departureDate = this.params[0];
        this._departureDVScale = this.params[1];
    }
    _clampDepartureInfos() {
        this._departureDate = clamp(this._departureDate, this.startDateMin, this.startDateMax);
        const { depDVScaleMin, depDVScaleMax } = this.config;
        this._departureDVScale = clamp(this._departureDVScale, depDVScaleMin, depDVScaleMax);
        this.params[0] = this._departureDate;
        this.params[1] = this._departureDVScale;
    }
    _getLegsInfo() {
        for (let i = 2; i < this.params.length; i += 4) {
            this._legs.push({
                duration: this.params[i],
                dsmOffset: this.params[i + 1],
                theta: this.params[i + 2],
                phi: this.params[i + 3]
            });
        }
    }
    _updateLegInfos(legIndex) {
        const leg = this._legs[legIndex];
        this.params[2 + legIndex * 4] = leg.duration;
        this.params[2 + legIndex * 4 + 1] = leg.dsmOffset;
        this.params[2 + legIndex * 4 + 2] = leg.theta;
        this.params[2 + legIndex * 4 + 3] = leg.phi;
    }
    _calculateFlybyTrajectory() {
        const body = this.system[this.sequence[this._sequenceIndex]];
        const localIncomingState = {
            pos: sub3(this._flybyIncomingState.pos, this._flybyBodyState.pos),
            vel: sub3(this._flybyIncomingState.vel, this._flybyBodyState.vel)
        };
        const flybyOrbit = stateToOrbitElements(localIncomingState, body);
        if (body.id == this._destinationBody.id) {
            const periRadius = periapsisRadius(flybyOrbit);
            const periapsisVel = velocityAtRadius(flybyOrbit, body, periRadius);
            const circularVel = circularVelocity(body, periRadius);
            this.totalDeltaV += periapsisVel - circularVel;
        }
        let nu1 = trueAnomalyFromOrbitalState(flybyOrbit, localIncomingState);
        let nu2 = -nu1;
        const tof = tofBetweenAnomalies(flybyOrbit, body, nu1, nu2);
        this.steps.push({
            orbitElts: flybyOrbit,
            attractorId: body.id,
            beginAngle: nu1,
            endAngle: nu2,
            duration: tof,
            dateOfStart: this._missionTime
        });
    }
    _calculateLegSecondArc() {
        const leg = this._legs[this._sequenceIndex - 1];
        const preDSMState = this._preDSMState;
        const origin = this.system[this.sequence[this._sequenceIndex - 1]];
        const target = this.system[this.sequence[this._sequenceIndex]];
        const startPos = preDSMState.pos;
        const encounterDate = this._missionTime + leg.duration;
        const targetState = getBodyStateAtDate(target, encounterDate, this._attractorMu);
        const arcDuration = (1 - leg.dsmOffset) * leg.duration;
        const incomingVel = solveLambert(startPos, targetState.pos, arcDuration, this._mainAttractor).v2;
        const relativeVel = sub3(incomingVel, targetState.vel);
        const incomingDir = normalize3(mult3(relativeVel, -1));
        const { thetaMin, thetaMax } = minMaxRingAngle(target.soi, target.radius, target.radius * 2);
        const pointIsValid = leg.theta >= thetaMin && leg.theta <= thetaMax;
        if (!pointIsValid) {
            const { theta, phi } = randomPointOnSphereRing(thetaMin, thetaMax);
            leg.theta = theta;
            leg.phi = phi;
        }
        const soiPointLocal = mult3(pointOnSphereRing(incomingDir, leg.theta, leg.phi), target.soi);
        const soiPoint = add3(targetState.pos, soiPointLocal);
        const { v1, v2 } = solveLambert(startPos, soiPoint, arcDuration, this._mainAttractor);
        const secondLegArc = stateToOrbitElements({ pos: startPos, vel: v1 }, this._mainAttractor);
        let nu1 = trueAnomalyFromOrbitalState(secondLegArc, { pos: startPos, vel: v1 });
        let nu2 = trueAnomalyFromOrbitalState(secondLegArc, { pos: soiPoint, vel: v2 });
        if (nu1 > nu2) {
            nu2 = TWO_PI + nu2;
        }
        this.totalDeltaV += mag3(sub3(v1, preDSMState.vel));
        const maneuvre = {
            deltaVToPrevStep: sub3(v1, preDSMState.vel),
            progradeDir: normalize3(preDSMState.vel),
            manoeuvrePosition: preDSMState.pos,
            context: {
                type: "dsm",
                originId: origin.id,
                targetId: target.id
            }
        };
        this.steps.push({
            orbitElts: secondLegArc,
            attractorId: this._mainAttractor.id,
            beginAngle: nu1,
            endAngle: nu2,
            duration: arcDuration,
            dateOfStart: this._lastStep.dateOfStart + this._lastStep.duration,
            maneuvre: maneuvre
        });
        this._flybyBodyState = targetState;
        this._flybyIncomingState = { pos: soiPoint, vel: v2 };
    }
    _calculateLegFirstArc() {
        const seqIndex = this._sequenceIndex;
        const leg = this._legs[seqIndex - 1];
        const isResonant = this.sequence[seqIndex - 1] == this.sequence[seqIndex];
        const lastStep = this._lastStep;
        const exitedBody = this.system[lastStep.attractorId];
        const localState = stateFromOrbitElements(lastStep.orbitElts, exitedBody.stdGravParam, lastStep.endAngle);
        const exitedBodyState = getBodyStateAtDate(exitedBody, this._missionTime, this._attractorMu);
        const exitState = {
            pos: add3(localState.pos, exitedBodyState.pos),
            vel: add3(localState.vel, exitedBodyState.vel)
        };
        const firstLegArc = stateToOrbitElements(exitState, this._mainAttractor);
        if (firstLegArc.semiMajorAxis >= this._mainAttractor.soi) {
            return false;
        }
        const { dsmOffsetMax, dsmOffsetMin, minLegDuration } = this.config;
        if (firstLegArc.eccentricity < 1) {
            const orbitPeriod = calculateOrbitPeriod(firstLegArc.semiMajorAxis, this._attractorMu);
            let minScale = 0.5;
            let maxScale = 1;
            if (isResonant) {
                minScale = 1;
                maxScale = 3;
            }
            const minDuration = minScale * orbitPeriod;
            const maxDuration = maxScale * orbitPeriod;
            leg.duration = clamp(leg.duration, minDuration, maxDuration);
            const revolutions = leg.duration / orbitPeriod;
            const minDSMOffset = Math.max((revolutions - 1) / revolutions, dsmOffsetMin);
            leg.dsmOffset = clamp(leg.dsmOffset, minDSMOffset, dsmOffsetMax);
        }
        leg.duration = clamp(leg.duration, minLegDuration, Infinity);
        leg.dsmOffset = clamp(leg.dsmOffset, dsmOffsetMin, dsmOffsetMax);
        const arcDuration = leg.dsmOffset * leg.duration;
        let legStartNu = trueAnomalyFromOrbitalState(firstLegArc, exitState);
        const preDSMState = propagateState(firstLegArc, legStartNu, arcDuration, this._mainAttractor);
        let dsmNu = trueAnomalyFromOrbitalState(firstLegArc, preDSMState);
        if (legStartNu > dsmNu) {
            dsmNu += TWO_PI;
        }
        if (isNaN(legStartNu) || isNaN(dsmNu)) {
            return false;
        }
        this.steps.push({
            orbitElts: firstLegArc,
            attractorId: this._mainAttractor.id,
            beginAngle: legStartNu,
            endAngle: dsmNu,
            duration: arcDuration,
            dateOfStart: this._lastStep.dateOfStart + this._lastStep.duration
        });
        this._preDSMState = preDSMState;
        return true;
    }
    _calculateEjectionOrbit() {
        const startBody = this.system[this.sequence[0]];
        const nextBody = this.system[this.sequence[1]];
        const parkingRadius = startBody.radius + this.depAltitude;
        const parkingVel = circularVelocity(startBody, parkingRadius);
        const ejectionVel = this._departureDVScale * ejectionVelocity(startBody, parkingRadius);
        const ejectionDV = ejectionVel - parkingVel;
        this.totalDeltaV += ejectionDV;
        const bodyPos = getBodyStateAtDate(startBody, this._departureDate, this._attractorMu).pos;
        const r1 = startBody.orbit.semiMajorAxis;
        const r2 = nextBody.orbit.semiMajorAxis;
        let { tangent, nu } = idealEjectionDirection(bodyPos, r2 < r1);
        const ejectionState = {
            pos: vec3(parkingRadius * Math.cos(nu), 0, parkingRadius * Math.sin(nu)),
            vel: mult3(tangent, ejectionVel),
        };
        const offsetAngle = hyperbolicEjectionOffsetAngle(ejectionVel, parkingRadius, startBody);
        const up = vec3(0, 1, 0);
        ejectionState.pos = rotate3(ejectionState.pos, up, -offsetAngle);
        ejectionState.vel = rotate3(ejectionState.vel, up, -offsetAngle);
        const ejectionOrbit = stateToOrbitElements(ejectionState, startBody);
        const exitAnomaly = soiExitTrueAnomaly(ejectionOrbit, startBody.soi);
        const tof = tofBetweenAnomalies(ejectionOrbit, startBody, 0, exitAnomaly);
        const progradeDir = normalize3(ejectionState.vel);
        const maneuvre = {
            deltaVToPrevStep: mult3(progradeDir, ejectionDV),
            progradeDir: progradeDir,
            manoeuvrePosition: ejectionState.pos,
            context: { type: "ejection" }
        };
        this.steps.push({
            orbitElts: ejectionOrbit,
            attractorId: startBody.id,
            beginAngle: 0,
            endAngle: exitAnomaly,
            duration: tof,
            dateOfStart: this._lastStepDateOfEnd,
            maneuvre: maneuvre
        });
    }
    _calculateParkingOrbit() {
        const startBody = this.system[this.sequence[0]];
        const orbitRadius = startBody.radius + this.depAltitude;
        this.steps.push({
            orbitElts: equatorialCircularOrbit(orbitRadius),
            attractorId: startBody.id,
            beginAngle: 0,
            endAngle: TWO_PI,
            duration: 0,
            dateOfStart: this._departureDate
        });
    }
}
