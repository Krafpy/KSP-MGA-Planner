class TrajectoryCalculator {
    private readonly _mainAttractor!: ICelestialBody;

    public steps: TrajectoryStep[] = [];

    private _vesselState!: OrbitalState3D;
    private _fbBodyState!: OrbitalState3D;
    private _preDSMState!: OrbitalState3D;

    private _depAltitude!:  number;
    private _startDateMin!: number;
    private _startDateMax!: number;
    private _params!:       Agent;

    private _bodiesOrbits!: OrbitalElements3D[];
    
    private _legs:   LegInfo[] = [];
    private _flybys: FlybyInfo[] = [];
    private _departureInfos!: DepartureInfo;

    private _secondArcsData: SecondArcData[] = [];

    public mathError: boolean = false;

    constructor(public readonly system: IOrbitingBody[], public readonly config: TrajectorySearchSettings, public readonly sequence: number[]){
        const attractorId = this._departureBody.orbiting;
        this._mainAttractor = this.system[attractorId];
    }

    private get _departureBody(){
        return this.system[this.sequence[0]];
    }

    private get _destinationBody(){
        const last = this.sequence.length - 1;
        return this.system[this.sequence[last]];
    }

    private get _lastStep(){
        return this.steps[this.steps.length - 1];
    }

    private get _lastStepEndDate(){
        const last = this._lastStep;
        const {dateOfStart, duration} = last;
        return dateOfStart + duration;
    }

    public addPrecomputedOrbits(bodiesOrbits: OrbitalElements3D[]){
        this._bodiesOrbits = bodiesOrbits;
    }

    public setParameters(depAltitude: number, startDateMin: number, startDateMax: number, params: Agent){
        this._depAltitude  = depAltitude;
        this._startDateMin = startDateMin;
        this._startDateMax = startDateMax;
        this._params = params;

        this._getDepartureSettings();
        this._getLegsSettings();
        this._getFlybySettings();
    }

    public reset(){
        this._legs   = [];
        this._flybys = [];
        this.steps   = [];
        this._secondArcsData = [];
        this.mathError = false;
    }

    /** 
     * Extracts the departures settings from the parameters to be used in a more convenient way.
     */
    private _getDepartureSettings(){
        this._departureInfos = {
            dateParam:  this._params[0],
            phaseParam: this._params[1],
            ejVelParam: this._params[2]
        };
    }

    /**
     * Retrieves the leg informations for the parameters to be used in a more convenient way.
     */
    private _getLegsSettings(){
        const {dsmOffsetMin, dsmOffsetMax} = this.config;
        for(let i = 1; i < this.sequence.length; i++) {
            const idx = 3 + (i-1)*4;
            const infos = {
                exitedBodyId:  this.sequence[i-1],
                targetBodyId:  this.sequence[i],
                durationParam: this._params[idx],
                duration:      0,
                dsmParam:      lerp(dsmOffsetMin, dsmOffsetMax, this._params[idx+1])
            };
            this._computeLegDuration(infos);
            this._legs.push(infos);
        }
    }

    /** Retrieves the flyby information from the parameters to be used in a more convenient way.
     */
    private _getFlybySettings(){
        for(let i = 1; i < this.sequence.length - 1; i++) {
            const idx = 3 + (i-1)*4 + 2;
            const infos = {
                flybyBodyId:    this.sequence[i],
                normAngleParam: this._params[idx],
                periRadiParam:  this._params[idx+1]
            };
            this._flybys.push(infos);
        }
    }

    /**
     * Computes the whole trajectory with its steps and maneuvers, and stores
     * the total delta V.
     */
    public compute(){
        // Compute the departure circular orbit and ejection orbit
        this._appendDepartureParkingOrbit();
        this._computeDepartureEjectionOrbit();

        const numOfLegs = this._legs.length;
        // Compute all the interplanetary arcs and flybys
        for(let i = 0; i < numOfLegs - 1; i++){
            const leg = this._legs[i];
            const flyby = this._flybys[i];
            this._computeFirstLegArc(leg);
            this._computeLegSecondArcSimple(leg);
            this._computeFlyby(flyby);
        }
        
        // Compute the last leg reaching the destination body
        // with no flyby
        const last = this._legs[numOfLegs-1];
        this._computeFirstLegArc(last);
        this._computeLegSecondArcSimple(last);

        // Check for math error that may have occured during the
        // calculation
        this.mathError = this._hasNaNValues();
        if(this.mathError)
            return;
    }

    public get totalDeltaV(){
        let total = 0;
        for(const step of this.steps){
            if(step.maneuvre) {
                const {maneuvre} = step;
                const {deltaVToPrevStep} = maneuvre;
                const dv = mag3(deltaVToPrevStep);
                total += dv;
            }
        }
        return total;
    }

    /**
     * Checks if there is a NaN value in the computed steps (caused by a math error)
     * @returns true if there is a NaN value in the computed steps, false otherwise.
     */
    private _hasNaNValues(){
        const hasNaN: (obj: Object) => boolean = obj => {
            for(const value of Object.values(obj)){
                if(typeof value == "object"){
                    if(hasNaN(value))
                        return true;
                } else if(typeof value == "number") {
                    if(isNaN(value))
                        return true;
                }
            }
            return false;
        };

        for(let i = this.steps.length - 1; i >= 0; i--){
            if(hasNaN(this.steps[i])){
                return true;
            }
        }
        return false;
    }

    /**
     * Completes the provided leg infos by calculating the leg duration from the already given
     * parameters
     * @param infos The leg infos to complete
     */
    private _computeLegDuration(infos: LegInfo){
        const exitedBody = this.system[infos.exitedBodyId];
        const {durationParam} = infos;
        const attr = this._mainAttractor;

        if(infos.exitedBodyId != infos.targetBodyId) { // if the leg is not resonant
            // The flight duration of the leg is between 35% and 75% of an ideal elliptic transfer
            // orbit from the exited body to the target body
            const targetBody = this.system[infos.targetBodyId];
            const exBodyA = exitedBody.orbit.semiMajorAxis;
            const tgBodyA = targetBody.orbit.semiMajorAxis;
            const a = 0.5 * (exBodyA + tgBodyA);
            const period = Physics3D.orbitPeriod(attr, a);
            infos.duration = lerp(0.35*period, 0.75*period, durationParam);

        } else { // if the leg is resonant
            // The flight duration of the leg is between 100% and 200% the orbital period of the
            // exited body
            const a = exitedBody.orbit.semiMajorAxis;
            const period = Physics3D.orbitPeriod(attr, a);
            infos.duration = lerp(1*period, 2*period, durationParam);
        }

        const {minLegDuration} = this.config;
        infos.duration = Math.max(minLegDuration, infos.duration);
    }

    /**
     * Recomputes the second arc of a all legs accounting this time for SOI enter points,
     * thus providing a more precise visualization of the orbit.
     */
     public recomputeLegsSecondArcs(){
        for(let i = 0; i < this._secondArcsData.length; i++){
            const data = this._secondArcsData[i];
            const step = this.steps[3 + i*3];
            
            this._recomputeSecondArc(step, data);
        }
    }

    /**
     * Recomputes the second arc of a leg accounting this time for SOI enter points.
     * @param lambertStep The step when the lambert arc to this flyby is described
     * @param arcData The data related to the lambert arc and flyby stored during the flyby calculation
     */
    private _recomputeSecondArc(lambertStep: TrajectoryStep, arcData: SecondArcData){
        const fbBody = this.system[arcData.fbBodyId];
        const {flybyOrbit, soiEnterAngle} = arcData;
        const localEnterState = Physics3D.orbitElementsToState(flybyOrbit, fbBody, soiEnterAngle);

        const {fbBodyState} = arcData;
        const targetEnterPos = add3(fbBodyState.pos, localEnterState.pos);

        const {preDSMState} = arcData;
        const {v1, v2} = Lambert.solve(preDSMState.pos, targetEnterPos, lambertStep.duration, this._mainAttractor);

        const postDSMState = {pos: preDSMState.pos, vel: v1};
        const encounterState = {pos: fbBodyState.pos, vel: v2};
        // Compute the orbit associated to this Lambert arc
        const arcOrbit = Physics3D.stateToOrbitElements(postDSMState, this._mainAttractor);
        // Compute the begin and end angles of the arc
        const angles = {
            begin: Physics3D.trueAnomalyFromOrbitalState(arcOrbit, postDSMState),
            end:   Physics3D.trueAnomalyFromOrbitalState(arcOrbit, encounterState)
        };
        const drawAngles = {
            begin: angles.begin,
            end:   angles.end
        };
        if(drawAngles.begin > drawAngles.end){
            drawAngles.end += TWO_PI;
        }

        lambertStep.orbitElts = arcOrbit;
        lambertStep.angles = angles;
        lambertStep.drawAngles = drawAngles;

        const maneuvre = lambertStep.maneuvre as ManeuvreInfo;
        const dsmDV = sub3(postDSMState.vel, preDSMState.vel);
        maneuvre.deltaVToPrevStep = dsmDV;
    }

    /**
     * Computes the flyby orbit with the provided parameters.
     * @param flybyInfo The flyby parameters
     */
    private _computeFlyby(flybyInfo: FlybyInfo){
        const body = this.system[flybyInfo.flybyBodyId];

        // Compute the relative velocity to the body when entering its SOI
        const bodyVel = this._fbBodyState.vel;
        const globalIncomingVel = this._vesselState.vel;
        const relativeIncomingVel = sub3(globalIncomingVel, bodyVel);
        const incomingVelMag = mag3(relativeIncomingVel);
        const incomingVelDir = div3(relativeIncomingVel, incomingVelMag);

        // Compute the normal vector of the orbit : we compute the vector perpendicular to the incoming
        // relative velocity and the body velocity (relative to the main attractor), and rotate it
        // around the incoming relative velocity direction by angle angle defined in the parameters.
        const normAngle = lerp(0, TWO_PI, flybyInfo.normAngleParam);
        const t_normal = normalize3(cross(relativeIncomingVel, bodyVel));
        const normal =  rotate3(t_normal, incomingVelDir, normAngle);    
        
        // Compute the temporary periapsis position vector, it is colinear to the incoming velcity
        // vector
        const t_periDir = incomingVelDir;
        const {fbRadiusMaxScale} = this.config;
        const periRadius = lerp(body.radius, fbRadiusMaxScale * body.radius, flybyInfo.periRadiParam);
        const t_periPos = mult3(t_periDir, periRadius);

        // Compute the temporary periapsis velocity velocity, at this point on the orbit,
        // the velocity vector is perpendicular to the periapsis vector.
        const periVelMag = Physics3D.deduceVelocityAtRadius(body, body.soi, incomingVelMag, periRadius); 
        const t_periVelDir = rotate3(t_periDir, normal, HALF_PI);
        const t_periVel = mult3(t_periVelDir, periVelMag);

        // Compute the temporary flyby orbit
        const t_periapsisState = {pos: t_periPos, vel: t_periVel};
        const t_flybyOrbit = Physics3D.stateToOrbitElements(t_periapsisState, body);

        // Compute the SOI enter and exit angles
        const exitAngle = Physics3D.trueAnomalyAtRadius(t_flybyOrbit, body.soi);
        const angles = {begin: -exitAngle, end: exitAngle};
        const drawAngles = {begin: angles.begin, end: angles.end};

        // Compute the angle between the incoming velocity vector and the velocity vector
        // on the calculated orbit at the SOI enter point
        const t_incomingVel = Physics3D.orbitElementsToState(t_flybyOrbit, body, angles.begin).vel;
        const t_incomingVelDir = normalize3(t_incomingVel);
        const dotCross = dot3(cross(incomingVelDir, t_incomingVelDir), normal);
        const dotVel = dot3(incomingVelDir, t_incomingVelDir);
        const offsetAngle = Math.atan2(dotCross, dotVel);
        
        // Recompute the flyby orbit by rotating the periapsis so that the incoming velocity calculated
        // on the orbit matches the incoming velocity computed at the beginning.
        // FIX: When `normAngle` is exactly 0 or TWO_PI, we must rotate by offsetAngle
        // and not -offsetAngle... Why this happens ? I don't know, probably some floating point error
        // stuff...
        const periPos = rotate3(t_periPos, normal, -offsetAngle);
        const periVel = rotate3(t_periVel, normal, -offsetAngle);
        const periapsisState = {pos: periPos, vel: periVel};
        const flybyOrbit = Physics3D.stateToOrbitElements(periapsisState, body);

        // Compute the duration of the flyby
        const tof = Physics3D.tofBetweenAnomalies(flybyOrbit, body, angles.begin, angles.end);
        
        // Append the flyby orbit
        this.steps.push({
            orbitElts:   flybyOrbit,
            attractorId: body.id,
            angles:      angles,
            drawAngles:  drawAngles,
            duration:    tof,
            dateOfStart: this._lastStepEndDate
        });

        // Compute the vessel state relative to the body when exiting its SOI
        const exitState = Physics3D.orbitElementsToState(flybyOrbit, body, exitAngle);
        this._vesselState = exitState;

        // Store the required information for eventual further recalculations of the
        // legs' lambert arcs
        this._secondArcsData.push({
            preDSMState:    this._preDSMState,
            fbBodyId:       body.id,
            fbBodyState:    this._fbBodyState,
            flybyOrbit:     flybyOrbit,
            soiEnterAngle:  angles.begin
        });
    }
    
    /**
     * Computes the second leg arc using a Lambert solver to aim at the body position
     * supposing a null radius SOI.
     * @param legInfo The leg parameters
     */
    private _computeLegSecondArcSimple(legInfo: LegInfo){
        const attr = this._mainAttractor;
        const lastStep = this._lastStep;
        const preDSMState = this._vesselState;

        // Compute the state of the body at the encounter date
        const encounterDate = lastStep.dateOfStart + legInfo.duration;
        const targetBody = this.system[legInfo.targetBodyId];
        const tgBodyOrbit = this._bodiesOrbits[targetBody.id];
        const tgBodyState = Physics3D.bodyStateAtDate(targetBody, tgBodyOrbit, attr, encounterDate);

        // Solve the Lambert problem to reach the body.
        // We suppose for now that the body has a null radius SOI, and so we target directly the body.
        const arcDuration = legInfo.duration * (1 - legInfo.dsmParam);
        const {v1, v2} = Lambert.solve(preDSMState.pos, tgBodyState.pos, arcDuration, attr);
        
        const postDSMState = {pos: preDSMState.pos, vel: v1};
        const encounterState = {pos: tgBodyState.pos, vel: v2};
        
        // Compute the orbit associated to this Lambert arc
        const arcOrbit = Physics3D.stateToOrbitElements(postDSMState, attr);
        // Compute the begin and end angles of the arc
        const angles = {
            begin: Physics3D.trueAnomalyFromOrbitalState(arcOrbit, postDSMState),
            end:   Physics3D.trueAnomalyFromOrbitalState(arcOrbit, encounterState)
        };
        const drawAngles = {
            begin: angles.begin,
            end:   angles.end
        };
        if(drawAngles.begin > drawAngles.end){
            drawAngles.end += TWO_PI;
        }

        // Compute DSM maneuver
        const progradeDir = normalize3(preDSMState.vel);
        const dsmDV = sub3(postDSMState.vel, preDSMState.vel);
        const maneuvre: ManeuvreInfo = {
            position:         preDSMState.pos,
            deltaVToPrevStep: dsmDV,
            progradeDir:      progradeDir,
            context:          {
                type: "dsm", 
                originId: legInfo.exitedBodyId, 
                targetId: legInfo.targetBodyId
            }
        };

        // Append the second arc orbit
        this.steps.push({
            orbitElts:   arcOrbit,
            attractorId: attr.id,
            angles:      angles,
            drawAngles:  drawAngles,
            duration:    arcDuration,
            dateOfStart: this._lastStepEndDate,
            maneuvre:    maneuvre
        });

        // Store the incoming state of the vessel (relative to the main attractor) at encounter
        // and the flyby body for the flyby calculation
        this._vesselState = encounterState;
        this._fbBodyState = tgBodyState;
    }

    /**
     * Computes the next leg first arc with the provided parameters.
     * @param legInfo The parameters of the leg
     */
    private _computeFirstLegArc(legInfo: LegInfo){
        // Compute the state of the vessel relatived to the exited body after exiting its SOI
        /*const lastStep = this._lastStep;
        const exitedBody = this.system[lastStep.attractorId];
        const localExitState = Physics3D.orbitElementsToState(lastStep.orbitElts, exitedBody, lastStep.angles.end);*/
        const localExitState = this._vesselState;
        const exitedBody = this.system[this._lastStep.attractorId];

        // Compute the exited body state relative to its attractor at the moment the vessel exits its SOI
        const bodyOrbit = this._bodiesOrbits[exitedBody.id];
        const exitDate = this._lastStepEndDate;
        const exitedBodyState = Physics3D.bodyStateAtDate(exitedBody, bodyOrbit, this._mainAttractor, exitDate);
        
        // Compute the vessel SOI-exit state relative to the main attractor (exited body's attractor)
        const exitState = {
            pos: add3(exitedBodyState.pos, localExitState.pos),
            vel: add3(exitedBodyState.vel, localExitState.vel),
        };

        // Compute the orbit of the vessel around the main attractor after exiting the exited body SOI.
        const arcOrbit = Physics3D.stateToOrbitElements(exitState, this._mainAttractor);
        const beginAngle = Physics3D.trueAnomalyFromOrbitalState(arcOrbit, exitState);
        // Propagate the vessel on the arc for the arc duration
        const arcDuration = legInfo.dsmParam * legInfo.duration;
        const preDSMState = Physics3D.propagateStateFromTrueAnomaly(arcOrbit, this._mainAttractor, beginAngle, arcDuration);
        let endAngle = Physics3D.trueAnomalyFromOrbitalState(arcOrbit, preDSMState);

        const angles = {begin: beginAngle, end: endAngle};

        // Compute the ends of the arc to show in the 3D view if the trajectory happens to be shown
        const drawAngles = {begin: angles.begin, end: angles.end};
        // It is possible that the duration of the arc is longer than the period of the arc orbit.
        // In that case we must display all the orbit but keep the last angle meaningful.
        const period = Physics3D.orbitPeriod(this._mainAttractor, arcOrbit.semiMajorAxis);
        if(arcDuration > period){
            drawAngles.begin = 0;
            drawAngles.end = TWO_PI;
        } else if(beginAngle > endAngle) {
            drawAngles.end += TWO_PI;
        }

        // Append the arc to the steps
        this.steps.push({
            orbitElts:   arcOrbit,
            attractorId: this._mainAttractor.id,
            angles:      angles,
            drawAngles:  drawAngles,
            duration:    arcDuration,
            dateOfStart: exitDate,
        });

        // Store the pre-DSM state to use it in the second arc maneuver calculation
        this._vesselState = preDSMState;
        this._preDSMState = preDSMState;
    }

    /**
     * Computes the ejection arc from the departure body parking orbit to exiting its SOI.
     */
    private _computeDepartureEjectionOrbit(){
        const curOrbit = this._lastStep.orbitElts;
        const depBody = this._departureBody;

        const {phaseParam, ejVelParam} = this._departureInfos;

        // Compute the phase angle, measured from the vector pointing to the body's
        // attractor
        const phase = lerp(0, TWO_PI, phaseParam);

        // Compute the ejection velocity magnitude, i.e. the velocity at the parking
        // orbit altitude which leads to exit the SOI with the specified
        // scale given in parameters.
        const ejVelMag0 = Physics3D.velocityToReachAltitude(depBody, curOrbit.semiMajorAxis, depBody.soi);
        const {depDVScaleMin, depDVScaleMax} = this.config;
        const ejVelMag = lerp(depDVScaleMin, depDVScaleMax, ejVelParam) * ejVelMag0;
        
        // Compute the ejection velocity vector; rotated by the phase angle relative to the
        // reference vector (1, 0, 0)
        const {vel, pos} = Physics3D.orbitElementsToState(curOrbit, depBody, phase);
        const progradeDir = normalize3(vel);
        const ejVel = mult3(progradeDir, ejVelMag);

        // Compute the ejection orbit
        const ejOrbit = Physics3D.stateToOrbitElements({pos, vel: ejVel}, depBody);
        
        // Compute the angle at which the SOI is exited
        const soiExitAngle = Physics3D.trueAnomalyAtRadius(ejOrbit, depBody.soi);
        // Compute the ejection maneuvre
        const ejDV = ejVelMag - mag3(vel);
        const maneuvre: ManeuvreInfo = {
            position:         pos,
            deltaVToPrevStep: mult3(progradeDir, ejDV),
            progradeDir:      progradeDir,
            context:          {type: "ejection"}
        };

        // Compute the duration of the flight from the parking orbit to SOI exit.
        const tof = Physics3D.tofBetweenAnomalies(ejOrbit, depBody, 0, soiExitAngle);

        // Append the ejection orbit
        this.steps.push({
            orbitElts:   ejOrbit,
            attractorId: depBody.id,
            angles:      {begin: 0, end: soiExitAngle},
            drawAngles:  {begin: 0, end: soiExitAngle},
            duration:    tof,
            dateOfStart: this._lastStepEndDate,
            maneuvre:    maneuvre
        });

        // Compute the state of the vessel relative to the exited body when exiting its SOI
        const exitState = Physics3D.orbitElementsToState(ejOrbit, depBody, soiExitAngle);
        this._vesselState = exitState;
    }

    /**
     * Calculates the orbital elements of the circular parking orbit
     * around the departure body and appends it to the steps.
     */
    private _appendDepartureParkingOrbit(){
        const {dateParam} = this._departureInfos;
        const radius = this._departureBody.radius + this._depAltitude;
        const dateMin = this._startDateMin;
        const dateMax = this._startDateMax;
        this.steps.push({
            orbitElts:   Physics3D.equatorialCircularOrbit(radius),
            attractorId: this._departureBody.id,
            angles:      {begin: 0, end: 0},
            drawAngles:  {begin: 0, end: TWO_PI},
            duration:    0,
            dateOfStart: lerp(dateMin, dateMax, dateParam)
        });
    }
}