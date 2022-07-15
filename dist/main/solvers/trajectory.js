import { createOrbitPoints, createLine, createSprite } from "../utilities/geometry.js";
import { Orbit } from "../objects/orbit.js";
import { KSPTime } from "../utilities/time.js";
export class Trajectory {
    constructor(steps, system, config) {
        this.steps = steps;
        this.system = system;
        this.config = config;
        this._orbitObjects = [];
        this._spriteObjects = [];
        this.orbits = [];
        this._maneuvres = [];
        this._flybys = [];
        this._spritesUpdateFunId = -1;
        for (const { orbitElts, attractorId } of this.steps) {
            const attractor = this.system.bodyFromId(attractorId);
            const orbit = Orbit.fromOrbitalElements(orbitElts, attractor, config.orbit);
            this.orbits.push(orbit);
        }
    }
    static preloadSpriteMaterials() {
        const textureLoader = new THREE.TextureLoader();
        const loaded = (name) => {
            return (texture) => {
                const material = new THREE.SpriteMaterial({
                    map: texture
                });
                this.sprites.set(name, material);
            };
        };
        textureLoader.load("sprites/encounter.png", loaded("encounter"));
        textureLoader.load("sprites/escape.png", loaded("escape"));
        textureLoader.load("sprites/maneuver.png", loaded("maneuver"));
    }
    draw(resolution) {
        this._createTrajectoryArcs(resolution);
        this._createManeuvreSprites();
        this._calculateManeuvresDetails();
        this._calculateFlybyDetails();
    }
    _createTrajectoryArcs(resolution) {
        this._orbitObjects = [];
        const { arcLineWidth } = this.config.orbit;
        const { samplePoints } = this.config.trajectoryDraw;
        const { scale } = this.config.rendering;
        let hue = 0;
        for (let i = 0; i < this.orbits.length; i++) {
            const orbit = this.orbits[i];
            const { begin, end } = this.steps[i].drawAngles;
            const orbitPoints = createOrbitPoints(orbit, samplePoints, scale, begin, end);
            const color = new THREE.Color(`hsl(${hue}, 100%, 70%)`);
            const orbitLine = createLine(orbitPoints, resolution, {
                color: color.getHex(),
                linewidth: arcLineWidth,
            });
            const group = this.system.objectsOfBody(orbit.attractor.id);
            group.add(orbitLine);
            this._orbitObjects.push(orbitLine);
            hue = (hue + 30) % 360;
        }
    }
    _createManeuvreSprites() {
        this._spriteObjects = [];
        for (let i = 0; i < this.steps.length; i++) {
            this._spriteObjects.push([]);
        }
        const { spritesSize } = this.config.trajectoryDraw;
        const { scale } = this.config.rendering;
        const encounterSprite = Trajectory.sprites.get("encounter");
        const escapeSprite = Trajectory.sprites.get("escape");
        const maneuverSprite = Trajectory.sprites.get("maneuver");
        const addSprite = (i, sprite, pos) => {
            sprite.position.set(pos.x, pos.y, pos.z);
            sprite.position.multiplyScalar(scale);
            const group = this.system.objectsOfBody(this.steps[i].attractorId);
            group.add(sprite);
            this._spriteObjects[i].push(sprite);
        };
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            const orbit = this.orbits[i];
            const { maneuvre, flyby } = step;
            if (maneuvre) {
                const sprite = createSprite(maneuverSprite, 0xFFFFFF, false, spritesSize);
                const { x, y, z } = maneuvre.position;
                const pos = new THREE.Vector3(x, y, z);
                addSprite(i, sprite, pos);
                const { type } = maneuvre.context;
                if (type == "ejection") {
                    const sprite = createSprite(escapeSprite, 0xFFFFFF, false, spritesSize);
                    const pos = orbit.positionFromTrueAnomaly(step.drawAngles.end);
                    addSprite(i, sprite, pos);
                }
            }
            else if (flyby) {
                const sprite1 = createSprite(encounterSprite, 0xFFFFFF, false, spritesSize);
                const sprite2 = createSprite(escapeSprite, 0xFFFFFF, false, spritesSize);
                const pos1 = orbit.positionFromTrueAnomaly(step.drawAngles.begin);
                const pos2 = orbit.positionFromTrueAnomaly(step.drawAngles.end);
                addSprite(i, sprite1, pos1);
                addSprite(i, sprite2, pos2);
            }
            else if (i == this.steps.length - 2) {
                const sprite = createSprite(encounterSprite, 0xFFFFFF, false, spritesSize);
                const pos = orbit.positionFromTrueAnomaly(step.drawAngles.begin);
                addSprite(i, sprite, pos);
            }
        }
        const updateSpritesDisplay = (camController) => {
            const camPos = camController.camera.position;
            const { scale } = this.config.rendering;
            const { spriteDispSOIMul } = this.config.solarSystem;
            for (let i = 0; i < this.steps.length; i++) {
                if (this._spriteObjects[i].length == 0)
                    continue;
                const step = this.steps[i];
                const body = this.system.bodyFromId(step.attractorId);
                const bodyPos = new THREE.Vector3();
                const bodyGroup = this.system.objectsOfBody(step.attractorId);
                bodyGroup.getWorldPosition(bodyPos);
                const dstToCam = bodyPos.distanceTo(camPos);
                const visible = dstToCam < scale * body.soi * spriteDispSOIMul;
                for (const sprite of this._spriteObjects[i]) {
                    sprite.visible = visible;
                }
            }
        };
        const id = this.system.addCustomUpdate(updateSpritesDisplay);
        this._spritesUpdateFunId = id;
    }
    _calculateManeuvresDetails() {
        const departureDate = this.steps[0].dateOfStart;
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            const { maneuvre } = step;
            if (maneuvre) {
                const orbit = this.orbits[i];
                const progradeDir = new THREE.Vector3(maneuvre.progradeDir.x, maneuvre.progradeDir.y, maneuvre.progradeDir.z);
                const normalDir = orbit.normal.clone();
                const radialDir = progradeDir.clone();
                radialDir.cross(normalDir);
                const deltaV = new THREE.Vector3(maneuvre.deltaVToPrevStep.x, maneuvre.deltaVToPrevStep.y, maneuvre.deltaVToPrevStep.z);
                const details = {
                    stepIndex: i,
                    dateMET: step.dateOfStart - departureDate,
                    progradeDV: progradeDir.dot(deltaV),
                    normalDV: normalDir.dot(deltaV),
                    radialDV: radialDir.dot(deltaV),
                };
                this._maneuvres.push(details);
            }
        }
    }
    _calculateFlybyDetails() {
        const departureDate = this.steps[0].dateOfStart;
        for (const { flyby } of this.steps) {
            if (flyby) {
                const body = this.system.bodyFromId(flyby.bodyId);
                let inc = flyby.inclination * 57.2957795131;
                inc = inc > 90 ? 180 - inc : inc;
                const details = {
                    bodyId: flyby.bodyId,
                    soiEnterDateMET: flyby.soiEnterDate - departureDate,
                    soiExitDateMET: flyby.soiExitDate - departureDate,
                    periAltitude: (flyby.periRadius - body.radius) / 1000,
                    inclinationDeg: inc
                };
                this._flybys.push(details);
            }
        }
    }
    fillResultControls(resultItems, systemTime, controls) {
        const depDate = new KSPTime(this.steps[0].dateOfStart, this.config.time);
        resultItems.totalDVSpan.innerHTML = this._totalDeltaV.toFixed(1);
        resultItems.depDateSpan.innerHTML = depDate.stringYDHMS("hms", "ut");
        const onDateClick = (date) => () => {
            this.system.date = date;
            controls.centerOnTarget();
            systemTime.time.dateSeconds = date;
            systemTime.update();
        };
        resultItems.depDateSpan.onclick = onDateClick(depDate.dateSeconds);
        const { stepSlider } = resultItems;
        stepSlider.setMinMax(0, this.steps.length - 1);
        stepSlider.input((index) => this._displayStepsUpTo(index));
        stepSlider.value = this.steps.length - 1;
        const selectorOptions = [];
        let maneuvreIdx = 0, flybyIdx = 0;
        let optionNumber = 0;
        for (let i = 0; i < this.steps.length; i++) {
            const { maneuvre, flyby } = this.steps[i];
            if (maneuvre) {
                const details = this._maneuvres[maneuvreIdx];
                const step = this.steps[details.stepIndex];
                const context = step.maneuvre.context;
                let optionName;
                if (context.type == "ejection") {
                    const startBodyName = this.system.bodyFromId(step.attractorId).name;
                    optionName = `${++optionNumber}: ${startBodyName} escape`;
                }
                else if (context.type == "dsm") {
                    const originName = this.system.bodyFromId(context.originId).name;
                    const targetName = this.system.bodyFromId(context.targetId).name;
                    optionName = `${++optionNumber}: ${originName}-${targetName} DSM`;
                }
                else {
                    const arrivalBodyName = this.system.bodyFromId(step.attractorId).name;
                    optionName = `${++optionNumber}: ${arrivalBodyName} circularization`;
                }
                const option = {
                    text: optionName,
                    index: i,
                    type: "maneuver",
                    origin: maneuvreIdx++
                };
                selectorOptions.push(option);
            }
            else if (flyby) {
                const details = this._flybys[flybyIdx];
                const bodyName = this.system.bodyFromId(details.bodyId).name;
                const optionName = `${++optionNumber}: ${bodyName} flyby`;
                const option = {
                    text: optionName,
                    index: i,
                    type: "flyby",
                    origin: flybyIdx++
                };
                selectorOptions.push(option);
            }
        }
        const optionNames = selectorOptions.map(opt => opt.text);
        const { detailsSelector } = resultItems;
        detailsSelector.fill(optionNames);
        detailsSelector.change((_, index) => {
            const option = selectorOptions[index];
            if (option.type == "maneuver") {
                const details = this._maneuvres[option.origin];
                const dateEMT = new KSPTime(details.dateMET, this.config.time);
                resultItems.dateSpan.innerHTML = dateEMT.stringYDHMS("hm", "emt");
                resultItems.progradeDVSpan.innerHTML = details.progradeDV.toFixed(1);
                resultItems.normalDVSpan.innerHTML = details.normalDV.toFixed(1);
                resultItems.radialDVSpan.innerHTML = details.radialDV.toFixed(1);
                resultItems.maneuvreNumber.innerHTML = (option.origin + 1).toString();
                const date = depDate.dateSeconds + dateEMT.dateSeconds;
                resultItems.dateSpan.onclick = onDateClick(date);
                resultItems.flybyDiv.hidden = true;
                resultItems.maneuverDiv.hidden = false;
            }
            else if (option.type == "flyby") {
                const details = this._flybys[option.origin];
                const startDateEMT = new KSPTime(details.soiEnterDateMET, this.config.time);
                const endDateEMT = new KSPTime(details.soiExitDateMET, this.config.time);
                resultItems.startDateSpan.innerHTML = startDateEMT.stringYDHMS("hm", "emt");
                resultItems.endDateSpan.innerHTML = endDateEMT.stringYDHMS("hm", "emt");
                resultItems.periAltitudeSpan.innerHTML = details.periAltitude.toFixed(0);
                resultItems.inclinationSpan.innerHTML = details.inclinationDeg.toFixed(0);
                resultItems.flybyNumberSpan.innerHTML = (option.origin + 1).toString();
                let enterDate = depDate.dateSeconds + startDateEMT.dateSeconds;
                resultItems.startDateSpan.onclick = onDateClick(enterDate);
                let exitDate = depDate.dateSeconds + endDateEMT.dateSeconds;
                resultItems.endDateSpan.onclick = onDateClick(exitDate);
                resultItems.flybyDiv.hidden = false;
                resultItems.maneuverDiv.hidden = true;
            }
        });
    }
    _displayStepsUpTo(index) {
        for (let i = 0; i < this.steps.length; i++) {
            const orbitLine = this._orbitObjects[i];
            const sprites = this._spriteObjects[i];
            const visible = i <= index;
            orbitLine.visible = visible;
            for (const sprite of sprites) {
                sprite.visible = visible;
            }
        }
    }
    get _totalDeltaV() {
        let total = 0;
        for (const details of this._maneuvres) {
            const x = details.progradeDV;
            const y = details.normalDV;
            const z = details.radialDV;
            total += new THREE.Vector3(x, y, z).length();
        }
        return total;
    }
    remove() {
        for (const object of this._orbitObjects) {
            if (object.parent)
                object.parent.remove(object);
        }
        for (const sprites of this._spriteObjects) {
            for (const sprite of sprites) {
                if (sprite.parent)
                    sprite.parent.remove(sprite);
            }
        }
        const updateId = this._spritesUpdateFunId;
        if (updateId >= 0) {
            this.system.removeCustomUpdate(updateId);
        }
    }
}
Trajectory.sprites = new Map();
