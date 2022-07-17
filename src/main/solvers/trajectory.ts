import { DiscreteRange } from "../editor/range.js";
import { Selector } from "../editor/selector.js";
import { TimeSelector } from "../editor/time-selector.js";
import { createOrbitPoints, createLine, createSprite } from "../utilities/geometry.js";
import { Orbit } from "../objects/orbit.js";
import { SolarSystem } from "../objects/system.js";
import { KSPTime } from "../utilities/time.js";
import { CameraController } from "../objects/camera.js";

export class Trajectory {
    static sprites = new Map<string, THREE.SpriteMaterial>();

    private _orbitObjects:  THREE.Object3D[] = [];
    private _spriteObjects: THREE.Sprite[][] = [];
    private _podSpriteIndex: number = 0;

    public readonly orbits: Orbit[] = [];

    private readonly _maneuvres: ManeuvreDetails[] = [];
    private readonly _flybys: FlybyDetails[] = [];

    private  _displayedSteps: boolean[] = [];
    private _spritesUpdateFunId: number = -1;

    constructor(public readonly steps: TrajectoryStep[], public readonly system: SolarSystem, public readonly config: Config) {
        for(const {orbitElts, attractorId} of this.steps) {
            const attractor = this.system.bodyFromId(attractorId);
            const orbit = Orbit.fromOrbitalElements(orbitElts, attractor, config.orbit);
            this.orbits.push(orbit);
        }
    }

    /**
     * Preloads all the sprite materials in the `sprites` map.
     */
    public static preloadSpriteMaterials(){
        const textureLoader = new THREE.TextureLoader();
        const loaded = (name: string) => {
            return (texture: THREE.Texture) => {
                const material = new THREE.SpriteMaterial({
                    map: texture
                });
                this.sprites.set(name, material);
            };
        };

        textureLoader.load("sprites/encounter.png", loaded("encounter"));
        textureLoader.load("sprites/escape.png", loaded("escape"));
        textureLoader.load("sprites/maneuver.png", loaded("maneuver"));
        textureLoader.load("sprites/pod.png", loaded("pod"));
    }

    /**
     * Draws the tajectory to the scene.
     * @param resolution The resolution of the canvas
     */
    public draw(resolution: {width: number, height: number}){
        const numSteps = this.steps.length;
        this._displayedSteps = Array(numSteps).fill(true);

        this._createTrajectoryArcs(resolution);
        this._createManeuvreSprites();
        this._calculateManeuvresDetails();
        this._calculateFlybyDetails();
    }

    /**
     * Computes all the leg arcs orbits, adds them to the scene and stores them.
     * @param resolution The resolution of the canvas
     */
    private _createTrajectoryArcs(resolution: {width: number, height: number}){
        this._orbitObjects = [];

        const {arcLineWidth} = this.config.orbit;
        const {samplePoints} = this.config.trajectoryDraw;
        const {scale} = this.config.rendering;
        
        let hue = 0;
        for(let i = 0; i < this.orbits.length; i++) {
            const orbit = this.orbits[i];
            const {begin, end} = this.steps[i].drawAngles;
            const orbitPoints = createOrbitPoints(orbit, samplePoints, scale, begin, end);
            const color = new THREE.Color(`hsl(${hue}, 100%, 70%)`);
            const orbitLine = createLine(orbitPoints, resolution, {
                color:      color.getHex(),
                linewidth:  arcLineWidth,
            });
            const group = this.system.objectsOfBody(orbit.attractor.id);
            group.add(orbitLine);
            this._orbitObjects.push(orbitLine);

            hue = (hue + 30) % 360;
        }
    }

    /**
     * Adds the various sprites to the scene and the collections for managment.
     */
    private _createManeuvreSprites(){
        // Empty the sprite collection, for each step there is a list
        // of sprites (initally empty).
        this._spriteObjects = [];
        for(let i = 0; i < this.steps.length; i++){
            this._spriteObjects.push([]);
        }

        const {spritesSize} = this.config.trajectoryDraw;
        const {scale} = this.config.rendering;

        const encounterSprite = <THREE.SpriteMaterial>Trajectory.sprites.get("encounter");
        const escapeSprite = <THREE.SpriteMaterial>Trajectory.sprites.get("escape");
        const maneuverSprite = <THREE.SpriteMaterial>Trajectory.sprites.get("maneuver");

        const addSprite = (i: number, sprite: THREE.Sprite, pos: THREE.Vector3) => {
            // adds a sprite to the sprite collection and the corresponding group
            sprite.position.set(pos.x, pos.y, pos.z);
            sprite.position.multiplyScalar(scale);
            const group = this.system.objectsOfBody(this.steps[i].attractorId);
            group.add(sprite);
            this._spriteObjects[i].push(sprite);
        };

        for(let i = 0; i < this.steps.length; i++){
            const step = this.steps[i];
            const orbit = this.orbits[i];
            const {maneuvre, flyby} = step;

            if(maneuvre){
                // if there is a maneuver, add the maneuver sprite
                const sprite = createSprite(maneuverSprite, 0xFFFFFF, false, spritesSize);
                const {x, y, z} = maneuvre.position;
                const pos = new THREE.Vector3(x, y, z);
                addSprite(i, sprite, pos);
                if(maneuvre.context.type == "ejection"){
                    // if the maneuver is an ejection, add the ejection maneuver sprite
                    const sprite = createSprite(escapeSprite, 0xFFFFFF, false, spritesSize);
                    const pos = orbit.positionFromTrueAnomaly(step.drawAngles.end);
                    addSprite(i, sprite, pos);
                }

            } else if(flyby){
                // if the maneuver is a flyby, add the encounter and escape sprites
                const sprite1 = createSprite(encounterSprite, 0xFFFFFF, false, spritesSize);
                const sprite2 = createSprite(escapeSprite, 0xFFFFFF, false, spritesSize);
                const pos1 = orbit.positionFromTrueAnomaly(step.drawAngles.begin);
                const pos2 = orbit.positionFromTrueAnomaly(step.drawAngles.end);
                addSprite(i, sprite1, pos1);
                addSprite(i, sprite2, pos2);

            } else if(i == this.steps.length - 2){
                // if it's insertion orbit, add the circularization burn maneuver sprite
                const sprite = createSprite(encounterSprite, 0xFFFFFF, false, spritesSize);
                const pos = orbit.positionFromTrueAnomaly(step.drawAngles.begin);
                addSprite(i, sprite, pos);
            }
        }

        const updateSpritesDisplay = (camController: CameraController) => {
            // display maneuver sprites only if we are close enough to the body
            // that contains them, and if the steps to which belong these maneuvers is
            // actually displayed
            const camPos = camController.camera.position;
            const {scale} = this.config.rendering;
            const {spriteDispSOIMul} = this.config.solarSystem;

            for(let i = 0; i < this.steps.length; i++){
                if(this._spriteObjects[i].length == 0) continue;

                const step = this.steps[i];
                const body = this.system.bodyFromId(step.attractorId);
                const bodyPos = new THREE.Vector3();
                const bodyGroup = <THREE.Group>this.system.objectsOfBody(step.attractorId);
                bodyGroup.getWorldPosition(bodyPos);

                const dstToCam = bodyPos.distanceTo(camPos);
                const visible = dstToCam < scale * body.soi * spriteDispSOIMul;

                for(const sprite of this._spriteObjects[i]){
                    sprite.visible = visible && this._displayedSteps[i];
                }
            }
        };

        // Add the display update as a callback of the system's update
        // function which is called once each frame.
        const id = this.system.addCustomUpdate(updateSpritesDisplay);
        this._spritesUpdateFunId = id;


        // Create pod sprite
        const {podSpriteSize} = this.config.trajectoryDraw;
        const podSpriteMat = <THREE.SpriteMaterial>Trajectory.sprites.get("pod");
        podSpriteMat.depthTest = false;
        const podSprite = createSprite(podSpriteMat, 0xFFFFFF, false, podSpriteSize);
        const group = this.system.objectsOfBody(this.steps[0].attractorId);
        group.add(podSprite);
        this._podSpriteIndex = 0;
        this._spriteObjects[this._podSpriteIndex].push(podSprite);
    }

    /**
     * Computes the maneuver details from the data given in the steps.
     */
    private _calculateManeuvresDetails(){
        const departureDate = this.steps[0].dateOfStart;

        for(let i = 0; i < this.steps.length; i++){
            const step = this.steps[i];
            const {maneuvre} = step;
            if(maneuvre){
                const orbit = this.orbits[i];

                const progradeDir = new THREE.Vector3(
                    maneuvre.progradeDir.x,
                    maneuvre.progradeDir.y,
                    maneuvre.progradeDir.z
                );
                const normalDir = orbit.normal.clone();
                const radialDir = progradeDir.clone();
                radialDir.cross(normalDir);

                const deltaV = new THREE.Vector3(
                    maneuvre.deltaVToPrevStep.x,
                    maneuvre.deltaVToPrevStep.y,
                    maneuvre.deltaVToPrevStep.z,
                );

                const details = {
                    stepIndex:   i,
                    dateMET:     step.dateOfStart - departureDate,
                    progradeDV:  progradeDir.dot(deltaV),
                    normalDV:    normalDir.dot(deltaV),
                    radialDV:    radialDir.dot(deltaV),
                };
                this._maneuvres.push(details);
            }
        }
    }

    /**
     * Computes the flyby details from the data given in the steps.
     */
    private _calculateFlybyDetails(){
        const departureDate = this.steps[0].dateOfStart;
        for(const {flyby} of this.steps){
            if(flyby){
                const body = this.system.bodyFromId(flyby.bodyId);
                // non oriented inclination compared to x-z plane
                let inc = flyby.inclination * 57.2957795131 // in degrees
                inc = inc > 90 ? 180 - inc : inc;
                const details: FlybyDetails = {
                    bodyId:          flyby.bodyId,
                    soiEnterDateMET: flyby.soiEnterDate - departureDate,
                    soiExitDateMET:  flyby.soiExitDate - departureDate,
                    periAltitude:    (flyby.periRadius - body.radius) / 1000, // in km
                    inclinationDeg:  inc
                }
                this._flybys.push(details);
            }
        }
    }
    
    /**
     * Fills the various HTML elements of the result panel with the data and events needed.
     * @param resultItems The list of HTML items attached to the result panel
     * @param systemTime The system time manager
     * @param controls The camera controller
     */
    public fillResultControls(resultItems: ResultPannelItems, systemTime: TimeSelector, controls: CameraController){
        const depDate = new KSPTime(this.steps[0].dateOfStart, this.config.time);

        // total delta-V
        resultItems.totalDVSpan.innerHTML = this._totalDeltaV.toFixed(1);
        // departure date
        resultItems.depDateSpan.innerHTML = depDate.stringYDHMS("hms", "ut");

        const onDateClick = (date: number) => () => {
            this.system.date = date;
            controls.centerOnTarget();
            systemTime.time.dateSeconds = date;
            systemTime.update();
            this.updatePodPosition(systemTime);
        };
        // set the system time to the departure date time when the span is clicked
        resultItems.depDateSpan.onclick = onDateClick(depDate.dateSeconds);

        // configure the step slider
        const {stepSlider} = resultItems;
        stepSlider.setMinMax(0, this.steps.length - 1);
        stepSlider.input((index: number) => this._displayStepsUpTo(index));
        stepSlider.value = this.steps.length - 1;

        // information about each selector options
        const selectorOptions: DetailsSelectorOption[] = [];

        // keep index for the numbering of each maneuver and flybys
        let maneuvreIdx = 0, flybyIdx = 0;
        let optionNumber = 0;

        for(let i = 0; i < this.steps.length; i++){
            const {maneuvre, flyby} = this.steps[i];
            if(maneuvre){
                const details = this._maneuvres[maneuvreIdx];
                const step = this.steps[details.stepIndex];
                const context = (<ManeuvreInfo>step.maneuvre).context;

                // name of the options to display in the selector, if it's a maneuver
                let optionName: string;
                if(context.type == "ejection") {
                    const startBodyName = this.system.bodyFromId(step.attractorId).name;
                    optionName = `${++optionNumber}: ${startBodyName} escape`;
                } else if(context.type == "dsm") {
                    const originName = this.system.bodyFromId(context.originId).name;
                    const targetName = this.system.bodyFromId(context.targetId).name;
                    optionName = `${++optionNumber}: ${originName}-${targetName} DSM`;
                } else {
                    const arrivalBodyName = this.system.bodyFromId(step.attractorId).name;
                    optionName = `${++optionNumber}: ${arrivalBodyName} circularization`;
                }

                const option: DetailsSelectorOption = {
                    text:   optionName,
                    index:  i,
                    type:   "maneuver",
                    origin: maneuvreIdx++
                };
                selectorOptions.push(option);

            } else if(flyby){
                // details the options in the selector, if it's a flyby
                const details = this._flybys[flybyIdx];
                const bodyName = this.system.bodyFromId(details.bodyId).name;
                const optionName = `${++optionNumber}: ${bodyName} flyby`;

                const option: DetailsSelectorOption = {
                    text:   optionName,
                    index:  i,
                    type:   "flyby",
                    origin: flybyIdx++
                };
                selectorOptions.push(option);
            }
        }

        // retrieve the list of option names only from their details
        const optionNames = selectorOptions.map(opt => opt.text);

        const {detailsSelector} = resultItems;
        detailsSelector.fill(optionNames);
        detailsSelector.change((_: string, index: number) => {
            // Fill the result panel with the correct data depending on what option
            // is selected in the selector
            const option = selectorOptions[index];
            
            if(option.type == "maneuver"){
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

            } else if(option.type == "flyby"){
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
       
        /*for(const step of this.steps){
            console.log(step);
        }*/
    }

    /**
     * Sets the visibility of the steps up to the provided indedx.
     * @param index The index of the last step to display
     */
    private _displayStepsUpTo(index: number){
        for(let i = 0; i < this.steps.length; i++){
            const orbitLine = this._orbitObjects[i];
            const sprites = this._spriteObjects[i];
            const visible = i <= index;
            orbitLine.visible = visible;
            for(const sprite of sprites){
                sprite.visible = visible;
            }
            this._displayedSteps[i] = visible;
        }
    }

    /**
     * Updates the position of the pod sprite on the trajectory to correspond
     * the the date selected on the system time.
     * @param systemTime The system time selector
     */
    public updatePodPosition(systemTime: TimeSelector){
        // Get and clamp the date for the pod
        const lastStep = this.steps[this.steps.length-1];
        const missionStart = this.steps[0].dateOfStart;
        const missionEnd = lastStep.dateOfStart + lastStep.duration;

        let date = systemTime.dateSeconds;
        if(date < missionStart) date = missionStart;
        else if(date > missionEnd) date = missionEnd;

        // Get the step where the pod is at this date
        let i = 1;
        for(; i < this.steps.length-1; i++){
            const {dateOfStart, duration} = this.steps[i];
            if(date >= dateOfStart && date < dateOfStart + duration)
                break;
        }
        i = Math.min(i, this.steps.length-2);

        const step = this.steps[i];

        // Remove the pod sprite from its current group
        const pod = <THREE.Sprite>this._spriteObjects[this._podSpriteIndex].pop();
        const curAttrId = this.steps[this._podSpriteIndex].attractorId;
        const curGroup = this.system.objectsOfBody(curAttrId);
        curGroup.remove(pod);

        // Add the sprite to the new group
        this._spriteObjects[i].push(pod);
        this._podSpriteIndex = i;
        const newAttrId = step.attractorId;
        const newGroup = this.system.objectsOfBody(newAttrId);
        newGroup.add(pod);

        // Compute its position on the leg arc where the pod is
        const orbit = this.orbits[i];
        const relDate = date - step.dateOfStart;
        const {startM} = step;
        const trueAnom = orbit.solveTrueAnomalyAtDate(startM, relDate);
        const pos = orbit.positionFromTrueAnomaly(trueAnom);

        const {scale} = this.config.rendering;
        pod.position.set(pos.x, pos.y, pos.z);
        pod.position.multiplyScalar(scale);
    }

    /**
     * Computes and returns the total delta-V of the trajectory
     */
    private get _totalDeltaV(){
        let total = 0;
        for(const details of this._maneuvres){
            const x = details.progradeDV;
            const y = details.normalDV;
            const z = details.radialDV;
            total += new THREE.Vector3(x, y, z).length();
        }
        return total;
    }

    /**
     * Removes all objects/events relative to this trajectory from the scene.
     */
    public remove() {
        for(const object of this._orbitObjects) {
            if(object.parent) object.parent.remove(object);
        }
        for(const sprites of this._spriteObjects) {
            for(const sprite of sprites){
                if(sprite.parent) sprite.parent.remove(sprite);
            }
        }
        const updateId = this._spritesUpdateFunId;
        if(updateId >= 0){
            this.system.removeCustomUpdate(updateId);
        }
    }
}