import { parseColor } from "./cfg-parser.js";
const GRAVITY_CONSTANT = 6.67430e-11;
const EARTH_ACCELERATION = 9.80665;
function choose(a, b) {
    return a === undefined ? b : a;
}
export function parseToSunConfig(sunConfig, templateBodies) {
    var _a;
    const template = templateBodies.get((_a = sunConfig.Template) === null || _a === void 0 ? void 0 : _a.name);
    const name = sunConfig.name;
    const radius = parseFloat(choose(sunConfig.Properties.radius, template === null || template === void 0 ? void 0 : template.radius));
    const soi = Infinity;
    const color = 0xffff00;
    const { stdGravParam, mass } = deduceStdGravParamAndMass(sunConfig, radius, template);
    return {
        name,
        radius,
        mass,
        stdGravParam,
        soi,
        color
    };
}
export function parseToBodyConfig(bodyConfig, templateBodies) {
    var _a;
    const template = templateBodies.get((_a = bodyConfig.Template) === null || _a === void 0 ? void 0 : _a.name);
    const name = bodyConfig.name;
    const radius = parseFloat(choose(bodyConfig.Properties.radius, template === null || template === void 0 ? void 0 : template.radius));
    const soi = parseFloat(bodyConfig.Properties.sphereOfInfluence || undefined);
    const { stdGravParam, mass } = deduceStdGravParamAndMass(bodyConfig, radius, template);
    const semiMajorAxis = parseFloat(choose(bodyConfig.Orbit.semiMajorAxis, template === null || template === void 0 ? void 0 : template.orbit.semiMajorAxis));
    const eccentricity = parseFloat(choose(bodyConfig.Orbit.eccentricity, template === null || template === void 0 ? void 0 : template.orbit.eccentricity));
    const inclination = parseFloat(choose(bodyConfig.Orbit.inclination, template === null || template === void 0 ? void 0 : template.orbit.inclination));
    const argOfPeriapsis = parseFloat(choose(bodyConfig.Orbit.argumentOfPeriapsis, template === null || template === void 0 ? void 0 : template.orbit.argOfPeriapsis));
    const ascNodeLongitude = parseFloat(choose(bodyConfig.Orbit.longitudeOfAscendingNode, template === null || template === void 0 ? void 0 : template.orbit.ascNodeLongitude));
    const meanAnomaly0 = deduceMeanAnomaly0(bodyConfig, template);
    const epoch = parseFloat(choose(bodyConfig.Orbit.epoch, template === null || template === void 0 ? void 0 : template.epoch));
    const color = deduceColorInteger(bodyConfig, template);
    const referenceBody = bodyConfig.Orbit.referenceBody;
    return {
        referenceBody,
        data: {
            name,
            radius,
            mass,
            stdGravParam,
            soi,
            orbit: {
                semiMajorAxis,
                eccentricity,
                inclination,
                argOfPeriapsis,
                ascNodeLongitude,
            },
            meanAnomaly0,
            epoch,
            color,
        },
    };
}
function deduceStdGravParamAndMass(bodyConfig, radius, template) {
    let stdGravParam = 0, mass = 0;
    if (bodyConfig.Properties.gravParameter !== undefined) {
        stdGravParam = parseFloat(bodyConfig.Properties.gravParameter);
    }
    else if (bodyConfig.Properties.geeASL !== undefined) {
        const geeASL = parseFloat(bodyConfig.Properties.geeASL);
        stdGravParam = geeASL * radius * radius * EARTH_ACCELERATION;
    }
    else if (bodyConfig.Properties.mass !== undefined) {
        mass = parseFloat(bodyConfig.Properties.mass);
        stdGravParam = mass * GRAVITY_CONSTANT;
    }
    else {
        stdGravParam = template === null || template === void 0 ? void 0 : template.stdGravParam;
    }
    return { stdGravParam, mass: mass != 0 ? mass : stdGravParam / GRAVITY_CONSTANT };
}
function deduceColorInteger(bodyConfig, template) {
    if (bodyConfig.Orbit.color !== undefined) {
        return parseColor(bodyConfig.Orbit.color);
    }
    else if (template === null || template === void 0 ? void 0 : template.color) {
        return template.color;
    }
    else {
        return 0xffffff;
    }
}
function deduceMeanAnomaly0(bodyConfig, template) {
    if (bodyConfig.Orbit.meanAnomalyAtEpoch !== undefined) {
        return parseFloat(bodyConfig.Orbit.meanAnomalyAtEpoch);
    }
    else if (bodyConfig.Orbit.meanAnomalyAtEpochD !== undefined) {
        const meanAnomaly0D = parseFloat(bodyConfig.Orbit.meanAnomalyAtEpochD);
        return meanAnomaly0D * Math.PI / 180;
    }
    else {
        return template === null || template === void 0 ? void 0 : template.meanAnomaly0;
    }
}
export function recomputeSOIs(orbiting, sun) {
    const attractor = (body) => body.orbiting == 0 ? sun : orbiting[body.orbiting - 1];
    for (const body of orbiting) {
        if (isNaN(body.soi)) {
            body.soi = body.orbit.semiMajorAxis * Math.pow(body.mass / attractor(body).mass, 2 / 5);
        }
    }
}
export function orderOrbitingBodies(orbitingUnordered, sunName) {
    const nameToInfo = new Map();
    for (const info of orbitingUnordered) {
        nameToInfo.set(info.data.name, info);
    }
    const systemTree = buildSystemTree(orbitingUnordered, sunName);
    for (const [, children] of systemTree) {
        children.sort((nameA, nameB) => {
            const orbitA = nameToInfo.get(nameA).data.orbit;
            const orbitB = nameToInfo.get(nameB).data.orbit;
            return orbitB.semiMajorAxis - orbitA.semiMajorAxis;
        });
    }
    const orderedNames = DFS(systemTree, sunName);
    const ids = new Map();
    for (let i = 0; i < orderedNames.length; i++) {
        ids.set(orderedNames[i], i);
    }
    const orbitingOrdered = [];
    for (let i = 1; i < orderedNames.length; i++) {
        const { referenceBody, data } = nameToInfo.get(orderedNames[i]);
        const orbiting = ids.get(referenceBody);
        orbitingOrdered.push({ id: i, orbiting, ...data });
    }
    return orbitingOrdered;
}
function buildSystemTree(orbitingUnordered, sunName) {
    const systemTree = new Map([[sunName, []]]);
    for (const { data } of orbitingUnordered) {
        systemTree.set(data.name, []);
    }
    for (const { data, referenceBody } of orbitingUnordered) {
        const children = systemTree.get(referenceBody);
        if (children === undefined) {
            throw new Error(`Missing body ${referenceBody}`);
        }
        children.push(data.name);
    }
    return systemTree;
}
function DFS(adj, start) {
    const visited = new Set();
    const stack = [start];
    const result = [];
    while (stack.length > 0) {
        const node = stack.pop();
        result.push(node);
        visited.add(node);
        for (const child of adj.get(node)) {
            if (!visited.has(child)) {
                stack.push(child);
            }
        }
    }
    return result;
}
