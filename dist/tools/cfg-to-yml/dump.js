export function dumpBodyToYaml(body) {
    const text = `- !!map\n` +
        `  id:                 ${body.id}\n` +
        `  name:               ${body.name}\n` +
        `  radius:             ${body.radius}\n` +
        (body.atmosphereAlt ? `  atmosphereAlt:      ${body.atmosphereAlt}\n` : "") +
        `  mass:               ${body.mass}\n` +
        `  stdGravParam:       ${body.stdGravParam}\n` +
        `  soi:                ${body.soi}\n` +
        `  orbit:\n` +
        `    semiMajorAxis:    ${body.orbit.semiMajorAxis}\n` +
        `    eccentricity:     ${body.orbit.eccentricity}\n` +
        `    inclination:      ${body.orbit.inclination}\n` +
        `    argOfPeriapsis:   ${body.orbit.argOfPeriapsis}\n` +
        `    ascNodeLongitude: ${body.orbit.ascNodeLongitude}\n` +
        `  meanAnomaly0:       ${body.meanAnomaly0}\n` +
        `  epoch:              ${body.epoch}\n` +
        `  orbiting:           ${body.orbiting}\n` +
        `  color:              0x${body.color.toString(16)}\n`;
    return text;
}
export function dumpSunToYaml(sun) {
    const text = `- !!map\n` +
        `  id:                 ${sun.id}\n` +
        `  name:               ${sun.name}\n` +
        `  radius:             ${sun.radius}\n` +
        (sun.atmosphereAlt ? `  atmosphereAlt:      ${sun.atmosphereAlt}\n` : "") +
        `  mass:               ${sun.mass}\n` +
        `  stdGravParam:       ${sun.stdGravParam}\n` +
        `  soi:                .inf\n` +
        `  color:              0x${sun.color.toString(16)}\n`;
    return text;
}
export function joinYamlBlocks(list) {
    return list.join("\n");
}
