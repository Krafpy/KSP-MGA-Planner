import { Orbit } from "../objects/orbit";

export function createSphere(radius: number, scale: number, color: number) {
    const geometry = new THREE.SphereGeometry(radius * scale, 50, 50);
    const material = new THREE.MeshBasicMaterial({color: color});
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

export function createSprite(material: THREE.SpriteMaterial, color: number, sizeAttenuation: boolean, scale: number){
    const sprite = new THREE.Sprite(material.clone());
    sprite.center.set(0.5, 0.5);
    sprite.material.sizeAttenuation = sizeAttenuation;
    sprite.material.color.set(color);
    sprite.scale.multiplyScalar(scale);
    return sprite;
}

export function createOrbitPoints(
    orbit:        Orbit,
    samplePoints: number, 
    scale:        number, 
    beginAngle:   number = 0, 
    endAngle:     number = 2 * Math.PI
){
    const positions: number[] = [];

    for(let i = 0; i <= samplePoints; i++){
        const anom = THREE.MathUtils.lerp(beginAngle, endAngle, i / samplePoints);
        const point = orbit.positionFromTrueAnomaly(anom);
        point.multiplyScalar(scale);
        positions.push(point.x, point.y, point.z);
    }
    
    return positions;
}

export function createLine(positions: number[], resolution: {width: number, height: number}, params: THREE.LineMaterialParameters){
    const geometry = new THREE.LineGeometry()
    geometry.setPositions(positions);
    const material = new THREE.LineMaterial(params);

    material.resolution.set(resolution.width, resolution.height);
    const line = new THREE.Line2(geometry, material);
    line.computeLineDistances();
    
    return line;
}