interface ICelestialBody {
    readonly id:            number;
    readonly name:          string;
    readonly radius:        number;
    readonly mass:          number;
    readonly stdGravParam:  number;
    readonly soi:           number;
    readonly color:         number;
}

interface IOrbitingBody extends ICelestialBody {
    readonly meanAnomaly0:  number;
    readonly orbiting:      number;
    readonly orbit:         IOrbit;
    readonly circularVel:   number;
}

interface IOrbit {
    readonly semiMajorAxis:     number;
    readonly apoapsis?:         number;
    readonly periapsis?:        number;
    readonly eccentricity:      number;
    readonly inclination:       number;
    readonly argOfPeriapsis:    number;
    readonly ascNodeLongitude:  number;
    readonly sideralPeriod?:    number;
    readonly orbitalParam?:     number;
    readonly meanMotion?:       number;
}

interface RenderingSettings {
    readonly scale:             number;
    readonly fov:               number;
    readonly nearPlane:         number;
    readonly farPlane:          number;
}

interface SystemDrawSettings {
    readonly planetFarSize:     number;
    readonly satFarSize:        number;
    readonly satDispRadii:      number;
    readonly mouseFocusDst:     number;
    readonly soiOpacity:        number;
}

interface OrbitSettings {
    readonly planetSampPoints:  number;
    readonly satSampPoints:     number;
    readonly orbitLineWidth:    number;
    readonly arcLineWidth:      number; 
}

interface TrajectoryDrawSettings {
    readonly samplePoints:      number;
    readonly maneuvreArrowSize: number;
}

interface CameraSettings {
    readonly startDist:         number;
    readonly maxDist:           number;
    readonly minDistRadii:      number;
    readonly dampingFactor:     number;
    readonly rotateSpeed:       number;
}

interface TimeSettings {
    readonly hoursPerDay:       number;
    readonly daysPerYear:       number;
}

interface FBSequenceSettings {
    readonly radiusSamples:     number;
    readonly initVelMaxScale:   number;
    readonly initVelSamples:    number;
    readonly maxPropositions:   number;
    readonly maxEvalStatuses:   number;
    readonly maxEvalSequences:  number;
    readonly splitLimit:        number;
}

interface EditorSettings {
    readonly defaultOrigin:     number;
    readonly defaultDest:       number;
    readonly defaultAltitude:   number;
}

interface WorkersSettings {
    readonly progressStep:      number;
}

interface TrajectorySearchSettings {
    readonly splitLimit:        number;
    readonly minCrossProba:     number;
    readonly maxCrossProba:     number;
    readonly crossProbaIncr:    number;
    readonly diffWeight:        number;
    readonly depDVScaleMin:     number;
    readonly depDVScaleMax:     number;
    readonly dsmOffsetMin:      number;
    readonly dsmOffsetMax:      number;
    readonly minLegDuration:    number;
    readonly popSizeDimScale:   number;
    readonly maxGenerations:    number;
    readonly fbRadiusMaxScale:  number;
}

interface Config {
    readonly rendering:         RenderingSettings;
    readonly solarSystem:       SystemDrawSettings;
    readonly orbit:             OrbitSettings;
    readonly camera:            CameraSettings;
    readonly time:              TimeSettings;
    readonly flybySequence:     FBSequenceSettings;
    readonly trajectorySearch:  TrajectorySearchSettings
    readonly editor:            EditorSettings;
    readonly workers:           WorkersSettings;
    readonly trajectoryDraw:    TrajectoryDrawSettings;
}

interface SequenceParameters {
    readonly departureId:       number, 
    readonly destinationId:     number,
    readonly maxSwingBys:       number,
    readonly maxResonant:       number,
    readonly maxBackLegs:       number,
    readonly maxBackSpacing:    number,
}

type ElapsedYDHMS = {years: number, days: number, hours: number, minutes: number, seconds: number};
type DateYDH = {year: number, day: number, hour: number};

type MessageToWorker = 
    | {label: "initialize", config: any}
    | {label: "run", input?: any}
    | {label: "continue", input?: any}
    | {label: "stop"}
    | {label: "pass", data: any}
;

type MessageFromWorker =     
    | {label: "initialized"}
    | {label: "progress", progress: number, data?: any}
    | {label: "complete", result: any}
    | {label: "stopped"}
    | {label: "debug", data: any}
    | {label: "received"}
;

type ProgressCallback = (progress: number, data?: any) => any;

type GeneratingSequence = {
    sequence: number[], 
    resonant: number, 
    backLegs: number,
    maxBackSpacing: number;
};

type EvaluationNode = {
    state:  OrbitalState2D,
    next:   number,
    depDV:  number
};

type Agent = number[];

type EvolutionSettings = {
    agentDim: number
    fitness: (x: Agent) => number,
    crMin: number,
    crMax: number,
    crInc: number,
    f:  number,
    maxGens: number
};

type Vector2 = {x: number, y: number};
type Vector3 = {x: number, y: number, z: number};

type OrbitalState2D = {
    pos:    Vector2,
    vel:    Vector2,
};

type OrbitalState3D = {
    pos:    Vector3,
    vel:    Vector3,
};

type OrbitalElements2D = {
    readonly eccentricity:       number,
    readonly periapsisVec:       Vector2,
    readonly semiMajorAxis:      number,
    readonly orbitalParam:       number,
    readonly clockwise:          boolean
}

type OrbitalElements3D = {
    readonly eccentricity:       number,
    readonly periapsisDir:       Vector3,
    readonly semiMajorAxis:      number,
    readonly inclination:        number,
    readonly argOfPeriapsis:     number,
    readonly ascNodeLongitude:   number,
    readonly ascNodeDir:         Vector3
    readonly orbitalParam:       number
};

type ArcEndsAngles = {begin: number, end: number};

type TrajectoryStep = {
    orbitElts:   OrbitalElements3D, 
    attractorId: number,
    angles:      ArcEndsAngles,
    drawAngles:  ArcEndsAngles,
    dateOfStart: number,
    duration:    number,
    maneuvre?:   ManeuvreInfo,
    flyby?:      FlybyInfo
};

type ManeuvreInfo = {
    position:         Vector3,
    deltaVToPrevStep: Vector3,
    progradeDir:      Vector3,
    context:          ManeuvreContext
};

type FlybyInfo = {
    bodyId:       number,
    soiEnterDate: number,
    soiExitDate:  number,
    periRadius:   number,
    inclination:  number
};


type ManeuvreContext = 
    | {type: "ejection"}
    | {type: "dsm", originId: number, targetId: number}
    | {type: "circularization"}
;

type AgentDepartureInfo = {
    phaseParam: number,
    ejVelParam: number,
    dateParam:  number,
};

type AgentLegInfo = {
    exitedBodyId:  number,
    targetBodyId:  number,
    durationParam: number,
    duration:      number,
    dsmParam:      number,
}

type AgentFlybyInfo = {
    flybyBodyId:    number,
    normAngleParam: number,
    periRadiParam:  number
};

type SecondArcData = {
    preDSMState:   OrbitalState3D,
    fbBodyId:      number,
    fbBodyState:   OrbitalState3D,
    flybyOrbit:    OrbitalElements3D,
    soiEnterAngle: number,
};

type GenerationResult = {
    bestSteps:  TrajectoryStep[],
    bestDeltaV: number,
    popChunk:   Agent[],
    fitChunk:   number[],
    dVsChunk:   number[]
}

type ManeuvreDetails = {
    stepIndex:   number,
    dateMET:     number,
    progradeDV:  number,
    normalDV:    number,
    radialDV:    number,
};

type FlybyDetails = {
    bodyId:          number,
    soiEnterDateMET: number,
    soiExitDateMET:  number,
    periAltitude:    number,
    inclinationDeg:  number
};

type ResultPannelItems = {
    dateSpan:         HTMLSpanElement,
    progradeDVSpan:   HTMLSpanElement,
    normalDVSpan:     HTMLSpanElement,
    radialDVSpan:     HTMLSpanElement,
    depDateSpan:      HTMLSpanElement,
    totalDVSpan:      HTMLSpanElement,
    maneuvreNumber:   HTMLSpanElement,

    flybyNumberSpan:  HTMLSpanElement,
    startDateSpan:    HTMLSpanElement,
    endDateSpan:      HTMLSpanElement,
    periAltitudeSpan: HTMLSpanElement,
    inclinationSpan:  HTMLSpanElement

    detailsSelector:  Selector,
    stepSlider:       DiscreteRange,

    maneuverDiv:      HTMLDivElement,
    flybyDiv:         HTMLDivElement
};

type DetailsSelectorOption = {
    text:   string,
    index:  number,
    type:   "maneuver" | "flyby",
    origin: number
};