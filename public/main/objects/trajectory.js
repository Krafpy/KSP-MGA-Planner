import { createOrbitPoints, createLine, createSprite } from "../utilities/geometry.js";
import { Orbit } from "./orbit.js";
import { TimeAndDate } from "./time.js";
export class Trajectory {
    constructor(steps, system, config) {
        this.steps = steps;
        this.system = system;
        this.config = config;
        this.orbits = [];
        this._objects = [];
        this._maneuvres = [];
        for (const { orbitElts, attractorId } of this.steps) {
            const attractor = this.system.bodyFromId(attractorId);
            const orbit = Orbit.fromOrbitalElements(orbitElts, attractor, config.orbit);
            this.orbits.push(orbit);
        }
    }
    static preloadArrowMaterial() {
        const textureLoader = new THREE.TextureLoader();
        const loaded = (texture) => {
            this.arrowMaterial = new THREE.SpriteMaterial({
                map: texture
            });
        };
        textureLoader.load("sprites/arrow-512.png", loaded);
    }
    draw(resolution) {
        this._createTrajectoryArcs(resolution);
        this._createManeuvreSprites();
        this._calculateManeuvresDetails();
    }
    _createTrajectoryArcs(resolution) {
        const { lineWidth } = this.config.orbit;
        const { samplePoints } = this.config.trajectoryDraw;
        const { scale } = this.config.rendering;
        for (let i = 0; i < this.orbits.length; i++) {
            const orbit = this.orbits[i];
            const { beginAngle, endAngle } = this.steps[i];
            const orbitPoints = createOrbitPoints(orbit, samplePoints, scale, beginAngle, endAngle);
            const color = new THREE.Color(`hsl(${i * 35 % 360}, 100%, 85%)`);
            const orbitLine = createLine(orbitPoints, resolution, {
                color: color.getHex(),
                linewidth: lineWidth,
            });
            const group = this.system.objectsOfBody(orbit.attractor.id);
            group.add(orbitLine);
            this._objects.push(orbitLine);
        }
    }
    _createManeuvreSprites() {
        const { maneuvreArrowSize } = this.config.trajectoryDraw;
        const { scale } = this.config.rendering;
        for (const step of this.steps) {
            if (step.maneuvre) {
                const group = this.system.objectsOfBody(step.attractorId);
                const sprite = createSprite(Trajectory.arrowMaterial, 0xFFFFFF, false, maneuvreArrowSize);
                const { x, y, z } = step.maneuvre.manoeuvrePosition;
                sprite.position.set(x, y, z);
                sprite.position.multiplyScalar(scale);
                group.add(sprite);
                this._objects.push(sprite);
            }
        }
    }
    _calculateManeuvresDetails() {
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
                    dateMET: step.dateOfStart - this.steps[0].dateOfStart,
                    progradeDV: progradeDir.dot(deltaV),
                    normalDV: normalDir.dot(deltaV),
                    radialDV: radialDir.dot(deltaV)
                };
                this._maneuvres.push(details);
            }
        }
    }
    fillResultControls(maneuvreSelector, resultSpans, stepSlider, systemTime) {
        const depDate = new TimeAndDate(this.steps[0].dateOfStart, this.config.time);
        resultSpans.totalDVSpan.innerHTML = this._totalDeltaV.toFixed(1);
        resultSpans.depDateSpan.innerHTML = depDate.stringYDHMS("hms", "date");
        resultSpans.depDateSpan.onclick = () => {
            systemTime.time.dateSeconds = depDate.dateSeconds;
            systemTime.update();
            systemTime.onChange();
        };
        stepSlider.setMinMax(0, this.steps.length - 1);
        stepSlider.input((index) => this._displayStepsUpTo(index));
        stepSlider.value = this.steps.length - 1;
        const selectorOptions = [];
        for (let i = 0; i < this._maneuvres.length; i++) {
            const details = this._maneuvres[i];
            const step = this.steps[details.stepIndex];
            const context = step.maneuvre.context;
            if (context.type == "ejection") {
                const startBodyName = this.system.bodyFromId(step.attractorId).name;
                const optionName = `${i + 1}: ${startBodyName} escape`;
                selectorOptions.push(optionName);
            }
            else {
                const originName = this.system.bodyFromId(context.originId).name;
                const targetName = this.system.bodyFromId(context.targetId).name;
                const optionName = `${i + 1}: ${originName}-${targetName} DSM`;
                selectorOptions.push(optionName);
            }
        }
        maneuvreSelector.fill(selectorOptions);
        maneuvreSelector.change((_, index) => {
            const details = this._maneuvres[index];
            const dateEMT = new TimeAndDate(details.dateMET, this.config.time);
            resultSpans.dateSpan.innerHTML = dateEMT.stringYDHMS("hm", "elapsed");
            resultSpans.progradeDVSpan.innerHTML = details.progradeDV.toFixed(1);
            resultSpans.normalDVSpan.innerHTML = details.normalDV.toFixed(1);
            resultSpans.radialDVSpan.innerHTML = details.radialDV.toFixed(1);
            resultSpans.maneuvreNumber.innerHTML = (index + 1).toString();
            resultSpans.dateSpan.onclick = () => {
                systemTime.time.dateSeconds = depDate.dateSeconds + dateEMT.dateSeconds;
                systemTime.update();
                systemTime.onChange();
            };
        });
    }
    _displayStepsUpTo(index) {
        for (let i = 0; i < this.steps.length; i++) {
            const orbitLine = this._objects[i];
            orbitLine.visible = i <= index;
        }
        const spritesStart = this.steps.length;
        for (let i = 0; i < this._maneuvres.length; i++) {
            const visible = this._objects[this._maneuvres[i].stepIndex].visible;
            this._objects[spritesStart + i].visible = visible;
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
        for (const object of this._objects) {
            if (object.parent)
                object.parent.remove(object);
        }
    }
}
