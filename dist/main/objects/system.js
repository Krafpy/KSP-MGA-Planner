import { OrbitingBody, CelestialBody } from "./body.js";
import * as Geometry from "../utilities/geometry.js";
export class SolarSystem {
    constructor(sun, bodies, config) {
        this.config = config;
        this._orbiting = new Map();
        this._objects = new Map();
        this._orbits = new Map();
        this._sois = new Map();
        this.showSOIs = false;
        this.sun = new CelestialBody(sun);
        for (const data of bodies) {
            const { orbiting } = data;
            const attractor = orbiting == 0 ? this.sun : this._orbiting.get(orbiting);
            const body = new OrbitingBody(data, attractor, this.config.orbit);
            this._orbiting.set(body.id, body);
            attractor.orbiters.push(body);
        }
    }
    get orbiting() {
        return [...this._orbiting.values()];
    }
    get bodies() {
        return [this.sun, ...this.orbiting];
    }
    get data() {
        const data = [];
        for (const body of this.bodies) {
            data.push(body.data);
        }
        return data;
    }
    bodyFromName(name) {
        for (const body of [this.sun, ...this.orbiting]) {
            if (body.name == name)
                return body;
        }
        throw new Error(`No body with name ${name}`);
    }
    bodyFromId(id) {
        if (id == 0) {
            return this.sun;
        }
        else {
            const body = this._orbiting.get(id);
            if (!body)
                throw new Error(`No body with id ${id}`);
            return body;
        }
    }
    objectsOfBody(id) {
        const object = this._objects.get(id);
        if (!object)
            throw new Error(`No 3D objects from body of id ${id}`);
        return object;
    }
    fillSceneObjects(scene, canvas) {
        const textureLoader = new THREE.TextureLoader();
        return new Promise((resolve, _) => {
            const loaded = (texture) => {
                const spriteMaterial = new THREE.SpriteMaterial({
                    map: texture
                });
                const { scale } = this.config.rendering;
                const { satSampPoints, planetSampPoints, orbitLineWidth } = this.config.orbit;
                const { planetFarSize, satFarSize } = this.config.solarSystem;
                const { soiOpacity } = this.config.solarSystem;
                const sunSize = scale * this.sun.radius * 2;
                const sunSprite = Geometry.createSprite(spriteMaterial, this.sun.color, true, sunSize);
                const sunGroup = new THREE.Group();
                sunGroup.add(sunSprite);
                this._objects.set(0, sunGroup);
                for (const body of this.orbiting) {
                    const { radius, soi, orbit, color, attractor } = body;
                    const parentGroup = this._objects.get(attractor.id);
                    const bodyGroup = new THREE.Group();
                    const samplePts = attractor.id == 0 ? planetSampPoints : satSampPoints;
                    const spriteSize = attractor.id == 0 ? planetFarSize : satFarSize;
                    const orbitPoints = Geometry.createOrbitPoints(orbit, samplePts, scale);
                    const ellipse = Geometry.createLine(orbitPoints, canvas, {
                        color: color,
                        linewidth: orbitLineWidth,
                    });
                    parentGroup.add(ellipse);
                    this._orbits.set(body.id, ellipse);
                    const soiMaterial = new THREE.MeshBasicMaterial({
                        color: color,
                        transparent: true,
                        opacity: soiOpacity
                    });
                    const soiLines = Geometry.createWireframeSphere(soi, scale, soiMaterial);
                    bodyGroup.add(soiLines);
                    this._sois.set(body.id, soiLines);
                    const bodyMaterial = new THREE.MeshBasicMaterial({
                        color: color
                    });
                    bodyGroup.add(Geometry.createSphere(radius, scale, bodyMaterial));
                    bodyGroup.add(Geometry.createSprite(spriteMaterial, color, false, spriteSize));
                    parentGroup.add(bodyGroup);
                    this._objects.set(body.id, bodyGroup);
                }
                scene.add(sunGroup);
                resolve(true);
            };
            textureLoader.load("sprites/circle-512.png", loaded);
        });
    }
    set date(date) {
        for (const body of this.orbiting) {
            const group = this._objects.get(body.id);
            const pos = body.positionAtDate(date).multiplyScalar(this.config.rendering.scale);
            group.position.copy(pos);
        }
    }
    update(camController) {
        this._updateSatellitesDisplay(camController);
        this._updateSOIsDisplay(camController);
    }
    _updateSatellitesDisplay(camController) {
        const { satDispRadii } = this.config.solarSystem;
        const { scale } = this.config.rendering;
        const camPos = camController.camera.position;
        for (const body of this.orbiting) {
            const { attractor } = body;
            if (attractor.id != 0) {
                const bodyGroup = this._objects.get(body.id);
                const parentPos = new THREE.Vector3();
                const parentGroup = this._objects.get(attractor.id);
                parentGroup.getWorldPosition(parentPos);
                const dstToCam = parentPos.distanceTo(camPos);
                const thresh = scale * satDispRadii * body.orbit.semiMajorAxis;
                const visible = dstToCam < thresh;
                const ellipse = this._orbits.get(body.id);
                ellipse.visible = visible;
                bodyGroup.visible = visible;
            }
        }
    }
    _updateSOIsDisplay(camController) {
        if (!this.showSOIs) {
            for (const sphere of this._sois.values()) {
                sphere.visible = false;
            }
        }
        else {
            const camPos = camController.camera.position;
            const { scale } = this.config.rendering;
            for (const body of this.orbiting) {
                const group = this._objects.get(body.id);
                const bodyPos = new THREE.Vector3();
                group.getWorldPosition(bodyPos);
                const dstToCam = camPos.distanceTo(bodyPos);
                const sphere = this._sois.get(body.id);
                sphere.visible = dstToCam > body.soi * scale;
            }
            for (const body of this.orbiting) {
                const soi = this._sois.get(body.id);
                const attrSoi = this._sois.get(body.attractor.id);
                if (attrSoi === null || attrSoi === void 0 ? void 0 : attrSoi.visible) {
                    soi.visible = false;
                }
                else {
                    soi.visible && (soi.visible = true);
                }
            }
        }
    }
}
