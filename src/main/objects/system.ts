import { OrbitingBody, CelestialBody } from "./body.js";
import { CameraController } from "./camera.js";
import { /*createSphere,*/ createLine, createOrbitPoints, createSprite } from "../utilities/geometry.js";

export class SolarSystem {
    readonly sun!:              CelestialBody;
    private readonly _orbiting: Map<number, OrbitingBody>   = new Map();
    private readonly _objects:  Map<number, THREE.Group>    = new Map();
    private readonly _orbits:   Map<number, THREE.Object3D> = new Map();

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
        const textureLoader = new THREE.TextureLoader();

        return new Promise(
        (resolve, _) => {
            const loaded = (texture: THREE.Texture) => {
                const material = new THREE.SpriteMaterial({
                    map: texture
                });

                const {scale} = this.config.rendering;
                const {satSampPoints, planetSampPoints, orbitLineWidth} = this.config.orbit;
                const {planetFarSize, satFarSize} = this.config.solarSystem;

                const sunSprite = createSprite(material, this.sun.color, true, scale * this.sun.radius * 2);
                const sunGroup = new THREE.Group();
                sunGroup.add(sunSprite);

                this._objects.set(0, sunGroup);

                for(const body of this.orbiting){
                    const {radius, orbit, color, attractor} = body;
                    const parentGroup = <THREE.Group>this._objects.get(attractor.id);
                    const bodyGroup = new THREE.Group();
                    
                    const samplePts  = attractor.id == 0 ? planetSampPoints : satSampPoints;
                    const spriteSize = attractor.id == 0 ? planetFarSize : satFarSize;
                    
                    const orbitPoints = createOrbitPoints(orbit, samplePts, scale);
                    const ellipse = createLine(orbitPoints, canvas, {
                        color: color,
                        linewidth: orbitLineWidth,
                    });
                    parentGroup.add(ellipse);

                    this._orbits.set(body.id, ellipse);

                    //bodyGroup.add(createSphere(radius, scale, color));
                    bodyGroup.add(createSprite(material, color, true, scale * radius * 2));
                    bodyGroup.add(createSprite(material, color, false, spriteSize));
                    parentGroup.add(bodyGroup);

                    this._objects.set(body.id, bodyGroup);
                }

                scene.add(sunGroup);
                
                resolve(true);
            };

            textureLoader.load("sprites/circle-512.png", loaded);
        });
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
     * Updates how sprites are displayed according to distance.
     */
    public updateSatellitesDisplay(camController: CameraController){
        for(const body of this.orbiting){
            if(body.attractor.id != 0) {
                const {satDispRadii} = this.config.solarSystem;
                const {scale} = this.config.rendering;

                const camPos = camController.camera.position;
                const objPos = new THREE.Vector3();
                const group  = <THREE.Group>this._objects.get(body.id);
                group.getWorldPosition(objPos);

                const dstToCam = objPos.distanceTo(camPos);
                const thresh = scale * satDispRadii * body.orbit.semiMajorAxis;
                const visible = dstToCam <  thresh;

                const ellipse = <THREE.Object3D>this._orbits.get(body.id);
                ellipse.visible = visible;
                group.visible   = visible;
            }
        }
    }
}