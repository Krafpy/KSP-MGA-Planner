"use strict";
class TrajectoryCalculator {
    constructor(system, config, sequence) {
        this.system = system;
        this.config = config;
        this.sequence = sequence;
        this.steps = [];
        this._legs = [];
        this._flybys = [];
        this._secondArcsData = [];
        const attractorId = this._departureBody.orbiting;
        this._mainAttractor = this.system[attractorId];
    }
    get _departureBody() {
        return this.system[this.sequence[0]];
    }
    get _destinationBody() {
        const last = this.sequence.length - 1;
        return this.system[this.sequence[last]];
    }
    get _lastStep() {
        return this.steps[this.steps.length - 1];
    }
    get _lastStepEndDate() {
        const last = this._lastStep;
        const { dateOfStart, duration } = last;
        return dateOfStart + duration;
    }
    addPrecomputedOrbits(bodiesOrbits) {
        this._bodiesOrbits = bodiesOrbits;
    }
    setParameters(depAltitude, destAltitude, startDateMin, startDateMax, params) {
        this._depAltitude = depAltitude;
        this._destAltitude = destAltitude;
        this._startDateMin = startDateMin;
        this._startDateMax = startDateMax;
        this._params = params;
        this._getDepartureSettings();
        this._getLegsSettings();
        this._getFlybySettings();
    }
    reset() {
        this._secondArcsData = [];
        this._legs = [];
        this._flybys = [];
        this.steps = [];
    }
    _getDepartureSettings() {
        this._departureInfos = {
            dateParam: this._params[0],
            phaseParam: this._params[1],
            ejVelParam: this._params[2]
        };
    }
    _getLegsSettings() {
        const { dsmOffsetMin, dsmOffsetMax } = this.config;
        for (let i = 1; i < this.sequence.length; i++) {
            const idx = 3 + (i - 1) * 4;
            const infos = {
                exitedBodyId: this.sequence[i - 1],
                targetBodyId: this.sequence[i],
                durationParam: this._params[idx],
                duration: 0,
                dsmParam: lerp(dsmOffsetMin, dsmOffsetMax, this._params[idx + 1])
            };
            this._computeLegDuration(infos);
            this._legs.push(infos);
        }
    }
    _getFlybySettings() {
        for (let i = 1; i < this.sequence.length - 1; i++) {
            const idx = 3 + (i - 1) * 4 + 2;
            const infos = {
                flybyBodyId: this.sequence[i],
                normAngleParam: this._params[idx],
                periRadiParam: this._params[idx + 1]
            };
            this._flybys.push(infos);
        }
    }
    compute() {
        this._appendDepartureParkingOrbit();
        this._computeDepartureEjectionOrbit();
        const numOfLegs = this._legs.length;
        for (let i = 0; i < numOfLegs - 1; i++) {
            const leg = this._legs[i];
            const flyby = this._flybys[i];
            this._computeFirstLegArc(leg);
            this._computeLegSecondArcSimple(leg);
            this._computeFlyby(flyby);
        }
        const last = this._legs[numOfLegs - 1];
        this._computeFirstLegArc(last);
        this._computeLegSecondArcSimple(last);
        this._computeInsertion();
        this._computeCircularization();
    }
    get totalDeltaV() {
        let total = 0;
        for (const step of this.steps) {
            if (step.maneuvre) {
                const { maneuvre } = step;
                const { deltaVToPrevStep } = maneuvre;
                const dv = mag3(deltaVToPrevStep);
                total += dv;
            }
        }
        return total;
    }
    _computeLegDuration(infos) {
        const exitedBody = this.system[infos.exitedBodyId];
        const { durationParam } = infos;
        const attr = this._mainAttractor;
        if (infos.exitedBodyId != infos.targetBodyId) {
            const targetBody = this.system[infos.targetBodyId];
            const exBodyA = exitedBody.orbit.semiMajorAxis;
            const tgBodyA = targetBody.orbit.semiMajorAxis;
            const a = 0.5 * (exBodyA + tgBodyA);
            const period = Physics3D.orbitPeriod(attr, a);
            infos.duration = lerp(0.35 * period, 0.75 * period, durationParam);
        }
        else {
            const a = exitedBody.orbit.semiMajorAxis;
            const period = Physics3D.orbitPeriod(attr, a);
            infos.duration = lerp(1 * period, 2 * period, durationParam);
        }
        const { minLegDuration } = this.config;
        infos.duration = Math.max(minLegDuration, infos.duration);
    }
    computeStartingMeanAnomalies() {
        for (let i = 1; i < this.steps.length - 1; i++) {
            const step = this.steps[i];
            const { orbitElts, angles } = step;
            const e = orbitElts.eccentricity;
            step.startM = Physics3D.meanAnomalyFromTrueAnomaly(angles.begin, e);
        }
    }
    recomputeLegsSecondArcs() {
        for (let i = 0; i < this._secondArcsData.length; i++) {
            const data = this._secondArcsData[i];
            const step = this.steps[3 + i * 3];
            this._recomputeSecondArc(step, data);
        }
    }
    _computeCircularization() {
        const body = this._destinationBody;
        const periapsisState = this._vesselState;
        const radius = body.radius + this._destAltitude;
        const circVelMag = Physics3D.circularVelocity(body, radius);
        const currVelMag = mag3(periapsisState.vel);
        const dvDir = normalize3(periapsisState.vel);
        const dv = mult3(dvDir, circVelMag - currVelMag);
        const newPeriapsisState = {
            pos: periapsisState.pos,
            vel: add3(periapsisState.vel, dv)
        };
        const circOrbit = Physics3D.stateToOrbitElements(newPeriapsisState, body);
        const maneuvre = {
            position: newPeriapsisState.pos,
            deltaVToPrevStep: dv,
            progradeDir: dvDir,
            context: { type: "circularization" }
        };
        this.steps.push({
            orbitElts: circOrbit,
            attractorId: this._destinationBody.id,
            angles: { begin: 0, end: 0 },
            drawAngles: { begin: 0, end: TWO_PI },
            duration: 0,
            dateOfStart: this._lastStepEndDate,
            startM: 0,
            maneuvre: maneuvre
        });
    }
    _computeInsertion() {
        const body = this._destinationBody;
        const bodyVel = this._fbBodyState.vel;
        const globalIncomingVel = this._vesselState.vel;
        const relativeIncomingVel = sub3(globalIncomingVel, bodyVel);
        const incomingVelMag = mag3(relativeIncomingVel);
        const incomingVelDir = div3(relativeIncomingVel, incomingVelMag);
        const normal = normalize3(cross(relativeIncomingVel, bodyVel));
        const t_periDir = incomingVelDir;
        const periRadius = body.radius + this._destAltitude;
        const t_periPos = mult3(t_periDir, periRadius);
        const periVelMag = Physics3D.deduceVelocityAtRadius(body, body.soi, incomingVelMag, periRadius);
        const t_periVelDir = rotate3(t_periDir, normal, HALF_PI);
        const t_periVel = mult3(t_periVelDir, periVelMag);
        const t_periapsisState = { pos: t_periPos, vel: t_periVel };
        const t_flybyOrbit = Physics3D.stateToOrbitElements(t_periapsisState, body);
        const enterAngle = Physics3D.trueAnomalyAtRadius(t_flybyOrbit, body.soi);
        const angles = { begin: -enterAngle, end: 0 };
        const drawAngles = { begin: angles.begin, end: angles.end };
        const t_incomingVel = Physics3D.orbitElementsToState(t_flybyOrbit, body, angles.begin).vel;
        const t_incomingVelDir = normalize3(t_incomingVel);
        const dotCross = dot3(cross(incomingVelDir, t_incomingVelDir), normal);
        const dotVel = dot3(incomingVelDir, t_incomingVelDir);
        const offsetAngle = Math.atan2(dotCross, dotVel);
        const periPos = rotate3(t_periPos, normal, -offsetAngle);
        const periVel = rotate3(t_periVel, normal, -offsetAngle);
        const periapsisState = { pos: periPos, vel: periVel };
        const insertionOrbit = Physics3D.stateToOrbitElements(periapsisState, body);
        const tof = Physics3D.tofBetweenAnomalies(insertionOrbit, body, angles.begin, angles.end);
        this.steps.push({
            orbitElts: insertionOrbit,
            attractorId: body.id,
            angles: angles,
            drawAngles: drawAngles,
            duration: tof,
            dateOfStart: this._lastStepEndDate,
            startM: 0
        });
        this._vesselState = periapsisState;
        this._secondArcsData.push({
            preDSMState: this._preDSMState,
            fbBodyId: body.id,
            fbBodyState: this._fbBodyState,
            flybyOrbit: insertionOrbit,
            soiEnterAngle: angles.begin
        });
    }
    _recomputeSecondArc(lambertStep, arcData) {
        const fbBody = this.system[arcData.fbBodyId];
        const { flybyOrbit, soiEnterAngle } = arcData;
        const localEnterState = Physics3D.orbitElementsToState(flybyOrbit, fbBody, soiEnterAngle);
        const { fbBodyState } = arcData;
        const targetEnterPos = add3(fbBodyState.pos, localEnterState.pos);
        const { preDSMState } = arcData;
        const { v1, v2 } = Lambert.solve(preDSMState.pos, targetEnterPos, lambertStep.duration, this._mainAttractor);
        const postDSMState = { pos: preDSMState.pos, vel: v1 };
        const encounterState = { pos: targetEnterPos, vel: v2 };
        const arcOrbit = Physics3D.stateToOrbitElements(postDSMState, this._mainAttractor);
        const angles = {
            begin: Physics3D.trueAnomalyFromOrbitalState(arcOrbit, postDSMState),
            end: Physics3D.trueAnomalyFromOrbitalState(arcOrbit, encounterState)
        };
        const drawAngles = {
            begin: angles.begin,
            end: angles.end
        };
        if (drawAngles.begin > drawAngles.end) {
            drawAngles.end += TWO_PI;
        }
        lambertStep.orbitElts = arcOrbit;
        lambertStep.angles = angles;
        lambertStep.drawAngles = drawAngles;
        const maneuvre = lambertStep.maneuvre;
        const dsmDV = sub3(postDSMState.vel, preDSMState.vel);
        maneuvre.deltaVToPrevStep = dsmDV;
    }
    _computeFlyby(flybyInfo) {
        const body = this.system[flybyInfo.flybyBodyId];
        const bodyVel = this._fbBodyState.vel;
        const globalIncomingVel = this._vesselState.vel;
        const relativeIncomingVel = sub3(globalIncomingVel, bodyVel);
        const incomingVelMag = mag3(relativeIncomingVel);
        const incomingVelDir = div3(relativeIncomingVel, incomingVelMag);
        const normAngle = lerp(0, TWO_PI, flybyInfo.normAngleParam);
        const t_normal = normalize3(cross(relativeIncomingVel, bodyVel));
        const normal = rotate3(t_normal, incomingVelDir, normAngle);
        const t_periDir = incomingVelDir;
        const { fbRadiusMaxScale } = this.config;
        const periRadius = lerp(body.radius, fbRadiusMaxScale * body.radius, flybyInfo.periRadiParam);
        const t_periPos = mult3(t_periDir, periRadius);
        const periVelMag = Physics3D.deduceVelocityAtRadius(body, body.soi, incomingVelMag, periRadius);
        const t_periVelDir = rotate3(t_periDir, normal, HALF_PI);
        const t_periVel = mult3(t_periVelDir, periVelMag);
        const t_periapsisState = { pos: t_periPos, vel: t_periVel };
        const t_flybyOrbit = Physics3D.stateToOrbitElements(t_periapsisState, body);
        const exitAngle = Physics3D.trueAnomalyAtRadius(t_flybyOrbit, body.soi);
        const angles = { begin: -exitAngle, end: exitAngle };
        const drawAngles = { begin: angles.begin, end: angles.end };
        const t_incomingVel = Physics3D.orbitElementsToState(t_flybyOrbit, body, angles.begin).vel;
        const t_incomingVelDir = normalize3(t_incomingVel);
        const dotCross = dot3(cross(incomingVelDir, t_incomingVelDir), normal);
        const dotVel = dot3(incomingVelDir, t_incomingVelDir);
        const offsetAngle = Math.atan2(dotCross, dotVel);
        const periPos = rotate3(t_periPos, normal, -offsetAngle);
        const periVel = rotate3(t_periVel, normal, -offsetAngle);
        const periapsisState = { pos: periPos, vel: periVel };
        const flybyOrbit = Physics3D.stateToOrbitElements(periapsisState, body);
        const tof = Physics3D.tofBetweenAnomalies(flybyOrbit, body, angles.begin, angles.end);
        const flybyDetails = {
            bodyId: body.id,
            soiEnterDate: this._lastStepEndDate,
            soiExitDate: this._lastStepEndDate + tof,
            periRadius: periRadius,
            inclination: flybyOrbit.inclination
        };
        this.steps.push({
            orbitElts: flybyOrbit,
            attractorId: body.id,
            angles: angles,
            drawAngles: drawAngles,
            duration: tof,
            dateOfStart: this._lastStepEndDate,
            startM: 0,
            flyby: flybyDetails
        });
        const exitState = Physics3D.orbitElementsToState(flybyOrbit, body, exitAngle);
        this._vesselState = exitState;
        this._secondArcsData.push({
            preDSMState: this._preDSMState,
            fbBodyId: body.id,
            fbBodyState: this._fbBodyState,
            flybyOrbit: flybyOrbit,
            soiEnterAngle: angles.begin
        });
    }
    _computeLegSecondArcSimple(legInfo) {
        const attr = this._mainAttractor;
        const lastStep = this._lastStep;
        const preDSMState = this._vesselState;
        const encounterDate = lastStep.dateOfStart + legInfo.duration;
        const targetBody = this.system[legInfo.targetBodyId];
        const tgBodyOrbit = this._bodiesOrbits[targetBody.id];
        const tgBodyState = Physics3D.bodyStateAtDate(targetBody, tgBodyOrbit, attr, encounterDate);
        const arcDuration = legInfo.duration * (1 - legInfo.dsmParam);
        const { v1, v2 } = Lambert.solve(preDSMState.pos, tgBodyState.pos, arcDuration, attr);
        const postDSMState = { pos: preDSMState.pos, vel: v1 };
        const encounterState = { pos: tgBodyState.pos, vel: v2 };
        const arcOrbit = Physics3D.stateToOrbitElements(postDSMState, attr);
        const angles = {
            begin: Physics3D.trueAnomalyFromOrbitalState(arcOrbit, postDSMState),
            end: Physics3D.trueAnomalyFromOrbitalState(arcOrbit, encounterState)
        };
        const drawAngles = {
            begin: angles.begin,
            end: angles.end
        };
        if (drawAngles.begin > drawAngles.end) {
            drawAngles.end += TWO_PI;
        }
        const progradeDir = normalize3(preDSMState.vel);
        const dsmDV = sub3(postDSMState.vel, preDSMState.vel);
        const maneuvre = {
            position: preDSMState.pos,
            deltaVToPrevStep: dsmDV,
            progradeDir: progradeDir,
            context: {
                type: "dsm",
                originId: legInfo.exitedBodyId,
                targetId: legInfo.targetBodyId
            }
        };
        this.steps.push({
            orbitElts: arcOrbit,
            attractorId: attr.id,
            angles: angles,
            drawAngles: drawAngles,
            duration: arcDuration,
            dateOfStart: this._lastStepEndDate,
            startM: 0,
            maneuvre: maneuvre
        });
        this._vesselState = encounterState;
        this._fbBodyState = tgBodyState;
    }
    _computeFirstLegArc(legInfo) {
        const localExitState = this._vesselState;
        const exitedBody = this.system[this._lastStep.attractorId];
        const bodyOrbit = this._bodiesOrbits[exitedBody.id];
        const exitDate = this._lastStepEndDate;
        const exitedBodyState = Physics3D.bodyStateAtDate(exitedBody, bodyOrbit, this._mainAttractor, exitDate);
        const exitState = {
            pos: add3(exitedBodyState.pos, localExitState.pos),
            vel: add3(exitedBodyState.vel, localExitState.vel),
        };
        const arcOrbit = Physics3D.stateToOrbitElements(exitState, this._mainAttractor);
        const beginAngle = Physics3D.trueAnomalyFromOrbitalState(arcOrbit, exitState);
        const arcDuration = legInfo.dsmParam * legInfo.duration;
        const preDSMState = Physics3D.propagateStateFromTrueAnomaly(arcOrbit, this._mainAttractor, beginAngle, arcDuration);
        let endAngle = Physics3D.trueAnomalyFromOrbitalState(arcOrbit, preDSMState);
        const angles = { begin: beginAngle, end: endAngle };
        const drawAngles = { begin: angles.begin, end: angles.end };
        const period = Physics3D.orbitPeriod(this._mainAttractor, arcOrbit.semiMajorAxis);
        if (arcDuration > period) {
            drawAngles.begin = 0;
            drawAngles.end = TWO_PI;
        }
        else if (beginAngle > endAngle) {
            drawAngles.end += TWO_PI;
        }
        this.steps.push({
            orbitElts: arcOrbit,
            attractorId: this._mainAttractor.id,
            angles: angles,
            drawAngles: drawAngles,
            duration: arcDuration,
            dateOfStart: exitDate,
            startM: 0
        });
        this._vesselState = preDSMState;
        this._preDSMState = preDSMState;
    }
    _computeDepartureEjectionOrbit() {
        const curOrbit = this._lastStep.orbitElts;
        const depBody = this._departureBody;
        const { phaseParam, ejVelParam } = this._departureInfos;
        const phase = lerp(0, TWO_PI, phaseParam);
        const ejVelMag0 = Physics3D.velocityToReachAltitude(depBody, curOrbit.semiMajorAxis, depBody.soi);
        const { depDVScaleMin, depDVScaleMax } = this.config;
        const ejVelMag = lerp(depDVScaleMin, depDVScaleMax, ejVelParam) * ejVelMag0;
        const { vel, pos } = Physics3D.orbitElementsToState(curOrbit, depBody, phase);
        const progradeDir = normalize3(vel);
        const ejVel = mult3(progradeDir, ejVelMag);
        const ejOrbit = Physics3D.stateToOrbitElements({ pos, vel: ejVel }, depBody);
        const soiExitAngle = Physics3D.trueAnomalyAtRadius(ejOrbit, depBody.soi);
        const ejDV = ejVelMag - mag3(vel);
        const maneuvre = {
            position: pos,
            deltaVToPrevStep: mult3(progradeDir, ejDV),
            progradeDir: progradeDir,
            context: { type: "ejection" }
        };
        const tof = Physics3D.tofBetweenAnomalies(ejOrbit, depBody, 0, soiExitAngle);
        this.steps.push({
            orbitElts: ejOrbit,
            attractorId: depBody.id,
            angles: { begin: 0, end: soiExitAngle },
            drawAngles: { begin: 0, end: soiExitAngle },
            duration: tof,
            dateOfStart: this._lastStepEndDate,
            startM: 0,
            maneuvre: maneuvre,
        });
        const exitState = Physics3D.orbitElementsToState(ejOrbit, depBody, soiExitAngle);
        this._vesselState = exitState;
    }
    _appendDepartureParkingOrbit() {
        const { dateParam } = this._departureInfos;
        const radius = this._departureBody.radius + this._depAltitude;
        const dateMin = this._startDateMin;
        const dateMax = this._startDateMax;
        this.steps.push({
            orbitElts: Physics3D.equatorialCircularOrbit(radius),
            attractorId: this._departureBody.id,
            angles: { begin: 0, end: 0 },
            drawAngles: { begin: 0, end: TWO_PI },
            duration: 0,
            dateOfStart: lerp(dateMin, dateMax, dateParam),
            startM: 0
        });
    }
}
