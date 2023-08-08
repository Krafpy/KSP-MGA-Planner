import { KSPTime } from "../time/time.js";
import { joinStrings } from "./array.js";
export function trajectoryToText(traj, seq, dateMode) {
    const { steps, system, config } = traj;
    const pairs = [];
    const add = (label, data, indent) => {
        pairs.push({ label, data, indent });
    };
    const space = () => add("", "", 0);
    add("Sequence", seq.seqStringFullNames, 0);
    const depDate = KSPTime(steps[0].dateOfStart, config.time, dateMode);
    const arrDate = KSPTime(steps[steps.length - 1].dateOfStart, config.time, dateMode);
    add("Departure", depDate.stringYDHMS("hms", "ut") + " UT", 0);
    add("Arrival", arrDate.stringYDHMS("hms", "ut") + " UT", 0);
    add("Total ΔV", `${traj.totalDeltaV.toFixed(1)} m/s`, 0);
    space();
    add("Steps", "", 0);
    let maneuvreIdx = 0, flybyIdx = 0;
    for (let i = 0; i < steps.length; i++) {
        const { maneuvre, flyby } = steps[i];
        if (maneuvre) {
            space();
            const step = steps[i];
            const details = traj.maneuvres[maneuvreIdx];
            const context = step.maneuvre.context;
            const { progradeDV, normalDV, radialDV, totalDV } = details;
            let label;
            if (context.type == "ejection") {
                const startBodyName = system.bodyFromId(step.attractorId).name;
                label = `${startBodyName} escape`;
            }
            else if (context.type == "dsm") {
                const originName = system.bodyFromId(context.originId).name;
                const targetName = system.bodyFromId(context.targetId).name;
                label = `${originName}-${targetName} DSM`;
            }
            else {
                const arrivalBodyName = system.bodyFromId(step.attractorId).name;
                label = `${arrivalBodyName} circularization`;
            }
            add(label, "", 1);
            const dateMET = KSPTime(details.dateMET, config.time, dateMode);
            add("Date", dateMET.toUT(depDate).stringYDHMS("hms", "ut") + " UT", 2);
            add("", dateMET.stringYDHMS("hms", "emt") + " MET", 2);
            if (details.ejectAngle !== undefined) {
                add("Ejection angle", `${details.ejectAngle.toFixed(1)}°`, 2);
            }
            add("ΔV", `${totalDV.toFixed(1)} m/s`, 2);
            add("Prograde", `${progradeDV.toFixed(1)}`, 3);
            add("Normal", `${normalDV.toFixed(1)}`, 3);
            add("Radial", `${radialDV.toFixed(1)}`, 3);
            maneuvreIdx++;
        }
        else if (flyby) {
            space();
            const details = traj.flybys[flybyIdx];
            const bodyName = system.bodyFromId(details.bodyId).name;
            const enterMET = KSPTime(details.soiEnterDateMET, config.time, dateMode);
            const exitMET = KSPTime(details.soiExitDateMET, config.time, dateMode);
            add(`Flyby around ${bodyName}`, "", 1);
            add("SOI enter date", enterMET.toUT(depDate).stringYDHMS("hms", "ut") + " UT", 2);
            add("", enterMET.stringYDHMS("hms", "emt") + " MET", 2);
            add("SOI exit date", exitMET.toUT(depDate).stringYDHMS("hms", "ut") + " UT", 2);
            add("", exitMET.stringYDHMS("hms", "emt") + " MET", 2);
            add("Periapsis altitude", `${details.periAltitude.toFixed(0)} km`, 2);
            add("Inclination", `${details.inclinationDeg.toFixed(0)}°`, 2);
            flybyIdx++;
        }
    }
    return pairsToString(pairs);
}
function pairsToString(pairs) {
    const lines = [];
    for (const pair of pairs) {
        if (pair.label == "") {
            lines.push("");
            continue;
        }
        let indent = " ".repeat(pair.indent * 2);
        lines.push(`${indent}${pair.label}:`);
    }
    let maxLen = 0;
    for (const line of lines) {
        maxLen = Math.max(maxLen, line.length);
    }
    for (let i = 0; i < pairs.length; i++) {
        if (pairs[i].label == "" && pairs[i].data == "")
            continue;
        const spaces = " ".repeat(maxLen - lines[i].length + 1);
        lines[i] += spaces + pairs[i].data;
    }
    return joinStrings(lines, "\n");
}
export function trajectoryToCSVData(traj, dateMode) {
    const { config, steps, orbits } = traj;
    const n = steps.length;
    const entries = [];
    const m = steps[n - 1].flyby !== undefined ? n - 1 : n - 2;
    for (let i = 2; i < m; i++) {
        const orbit = orbits[i];
        const step = steps[i];
        const { maneuvre, flyby, dateOfStart, startM } = step;
        if (maneuvre && maneuvre.context.type == "dsm") {
            const startState = orbit.stateAtDate(startM, 0, 0);
            entries.push({
                type: "dsm",
                bodyId: step.attractorId,
                timeUT: KSPTime(dateOfStart, config.time, dateMode).dateSeconds,
                pos: startState.pos,
                vel: startState.vel
            });
        }
        else if (!maneuvre && !flyby) {
            const startState = orbit.stateAtDate(startM, 0, 0);
            entries.push({
                type: "flyby",
                bodyId: steps[i - 1].attractorId,
                timeUT: KSPTime(dateOfStart, config.time, dateMode).dateSeconds,
                pos: startState.pos,
                vel: startState.vel
            });
        }
    }
    entries[0].type = "escape";
    const arrivalDate = steps[m - 1].dateOfStart + steps[m - 1].duration;
    const arrivalState = orbits[m - 1].stateAtDate(steps[m - 1].startM, 0, arrivalDate);
    entries.push({
        type: "arrival",
        bodyId: steps[n - 1].attractorId,
        timeUT: KSPTime(arrivalDate, config.time, dateMode).dateSeconds,
        pos: arrivalState.pos,
        vel: arrivalState.vel
    });
    const lines = ["type,bodyId,timeUT,posX,posY,posZ,velX,velY,velZ"];
    for (const { type, bodyId, timeUT, pos, vel } of entries) {
        lines.push(`${type},${bodyId},${timeUT},${pos.x},${pos.y},${pos.z},${vel.x},${vel.y},${vel.z}`);
    }
    return joinStrings(lines, "\n");
}
