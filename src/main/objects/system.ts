import { OrbitingBody, CelestialBody } from "./body.js";
import { CameraController } from "./camera.js";
import * as Geometry from "../utilities/geometry.js";
import { SpriteManager } from "../utilities/sprites.js";

export class SolarSystem {
    readonly sun!:              CelestialBody;
    private readonly _orbiting: Map<number, OrbitingBody>   = new Map();
    private readonly _objects:  Map<number, THREE.Group>    = new Map();
    private readonly _orbits:   Map<number, THREE.Object3D> = new Map();
    private readonly _sois:     Map<number, THREE.Object3D> = new Map();
    public showSOIs: boolean = false;

    private _customUpdates: ((cam: CameraController) => void)[] = [];

    constructor(sun: ICelestialBody, bodies: IOrbitingBody[], public readonly config: Config) {
        this.sun = new CelestialBody(sun);
        
        for(const data of bodies){
            const {orbiting} = data;
            
            const attractor = orbiting == 0 ? this.sun : <OrbitingBody>this._orbiting.get(orbiting);
            const body = new OrbitingBody(data, attractor, this.config.orbit);
            
            this._orbiting.set(body.id, body);
            attractor.orbiters.push(body);
        }
    }

    public get orbiting() {
        return [...this._orbiting.values()];
    }

    public get bodies(){
        return [this.sun, ...this.orbiting];
    }

    public get data() {
        const data = [];
        for(const body of this.bodies) {
            data.push(body.data);
        }
        return data;
    }

    public bodyFromName(name: string){
        for(const body of [this.sun, ...this.orbiting]){
            if(body.name == name)
                return body;
        }
        throw new Error(`No body with name ${name}`);
    }

    public bodyFromId(id: number) {
        if(id == 0) {
            return this.sun;
        } else {
            const body = this._orbiting.get(id);
            if(!body)
                throw new Error(`No body with id ${id}`);
            return body;
        }
    }

    public objectsOfBody(id: number) {
        const object = this._objects.get(id);
        if(!object)
            throw new Error(`No 3D objects from body of id ${id}`);
        return object;
    }

    /**
     * Creates the 3D objects of all the celestial bodies.
     * @returns The promise to wait for the loading to complete.
     */
    public fillSceneObjects(scene: THREE.Scene, canvas: HTMLCanvasElement) { 
        const {scale} = this.config.rendering;
        const {satSampPoints, planetSampPoints, orbitLineWidth} = this.config.orbit;
        const {planetFarSize, satFarSize} = this.config.solarSystem;
        const {soiOpacity} = this.config.solarSystem;

        const spriteMaterial = SpriteManager.getMaterial("circle");

        const sunSize = scale * this.sun.radius * 2;
        const sunSprite = Geometry.createSprite(spriteMaterial, this.sun.color, true, sunSize);
        const sunGroup = new THREE.Group();
        sunGroup.add(sunSprite);

        this._objects.set(0, sunGroup);

        for(const body of this.orbiting){
            const {radius, soi, orbit, color, attractor} = body;
            const parentGroup = <THREE.Group>this._objects.get(attractor.id);
            const bodyGroup = new THREE.Group();
            
            const samplePts  = attractor.id == 0 ? planetSampPoints : satSampPoints;
            const spriteSize = attractor.id == 0 ? planetFarSize : satFarSize;
            
            const orbitPoints = Geometry.createOrbitPoints(orbit, samplePts, scale);
            const ellipse = Geometry.createLine(orbitPoints, canvas, {
                color: color,
                linewidth: orbitLineWidth,
            });
            parentGroup.add(ellipse);

            this._orbits.set(body.id, ellipse);

            // Create the SOI sphere
            const soiMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: soiOpacity
            });
            const soiLines = Geometry.createWireframeSphere(soi, scale, soiMaterial)
            bodyGroup.add(soiLines);

            this._sois.set(body.id, soiLines);

            // Create body sphere and sprites
            const bodyMaterial = new THREE.MeshBasicMaterial({
                color: color
            });
            bodyGroup.add(Geometry.createSphere(radius, scale, bodyMaterial));
            bodyGroup.add(Geometry.createSprite(spriteMaterial, color, false, spriteSize));
            parentGroup.add(bodyGroup);

            this._objects.set(body.id, bodyGroup);
        }

        scene.add(sunGroup);
    }

    /**
     * Sets the date of the system and moves the bodies to their 
     * corresponding location.
     */
    public set date(date: number) {
        for(const body of this.orbiting) {
            const group = <THREE.Group>this._objects.get(body.id);
            const pos = body.positionAtDate(date).multiplyScalar(this.config.rendering.scale);
            group.position.copy(pos);
        }
    }

    /**
     * Function called at each frame.
     * @param camController The camera controller of the scene
     */
    public update(camController: CameraController){
        this._updateSatellitesDisplay(camController);
        this._updateSOIsDisplay(camController);
        
        for(const f of this._customUpdates){
            f(camController);
        }
    }

    /**
     * Updates how sprites are displayed according to distance.
     */
    private _updateSatellitesDisplay(camController: CameraController){
        const {satDispRadii} = this.config.solarSystem;
        const {scale} = this.config.rendering;
        const camPos = camController.camera.position;

        for(const body of this.orbiting){
            const {attractor} = body;
            const bodyGroup  = <THREE.Group>this._objects.get(body.id);

            if(attractor.id != 0) {
                const parentPos = new THREE.Vector3();
                const parentGroup = <THREE.Group>this._objects.get(attractor.id);
                parentGroup.getWorldPosition(parentPos);

                const dstToCam = parentPos.distanceTo(camPos);
                const thresh = scale * satDispRadii * body.orbit.semiMajorAxis;
                const visible = dstToCam <  thresh;

                const ellipse = <THREE.Object3D>this._orbits.get(body.id);
                ellipse.visible = visible;
                bodyGroup.visible   = visible;
            } else {
                bodyGroup.visible = true;
            }
        }
    }

    /**
     * Updates how SOIs are displayed based on camera position.
     */
    private _updateSOIsDisplay(camController: CameraController){
        if(!this.showSOIs){
            for(const sphere of this._sois.values()){
                sphere.visible = false;
            }
        } else {
            const camPos = camController.camera.position;
            const {scale} = this.config.rendering;

            for(const body of this.orbiting){
                const group = <THREE.Group>this._objects.get(body.id);
                const bodyPos = new THREE.Vector3();
                group.getWorldPosition(bodyPos);

                const dstToCam = camPos.distanceTo(bodyPos);

                const sphere = <THREE.Object3D>this._sois.get(body.id);
                sphere.visible = dstToCam > body.soi * scale;
            }

            for(const body of this.orbiting){
                const soi = <THREE.Object3D>this._sois.get(body.id);
                const attrSoi = this._sois.get(body.attractor.id);
                if(attrSoi?.visible){
                    soi.visible = false;
                } else {
                    soi.visible &&= true;
                }
            }
        }
    }

    /**
     * Adds a function to be called at each new frame.
     * @param f A function
     * @returns An id identifying the function that has been added
     */
     public addCustomUpdate(f: (cam: CameraController) => void){
        const id = this._customUpdates.length;
        this._customUpdates.push(f);
        return id;
    }

    /**
     * Removes a function from the calling list to be run at each frame.
     * @param id The function id, created with `addCustomUpdate`
     */
    public removeCustomUpdate(id: number){
        try {
            this._customUpdates.splice(id);
        } catch(err) {
            console.error(`Failed removing update callback with id ${id}`, err);
        }
    }

    /**
     * Removes all custom functions added to the update list.
     */
    public clearCustomUpdate(){
        this._customUpdates = [];
    }
}