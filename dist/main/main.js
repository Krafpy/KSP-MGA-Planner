import { initEditor } from "./editor/editor.js";
import { SolarSystem } from "./objects/system.js";
import { CameraController } from "./objects/camera.js";
import { loadConfig, loadBodiesData } from "./utilities/data.js";
import { Trajectory } from "./solvers/trajectory.js";
window.onload = main;
async function main() {
    const canvas = document.getElementById("three-canvas");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const config = await loadConfig();
    const camera = new THREE.PerspectiveCamera(config.rendering.fov, width / height, config.rendering.nearPlane, config.rendering.farPlane);
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    const bodiesData = await loadBodiesData();
    const system = new SolarSystem(bodiesData.sun, bodiesData.bodies, config);
    await system.fillSceneObjects(scene, canvas);
    const controls = new CameraController(camera, canvas, system, config);
    controls.targetBody = system.sun;
    Trajectory.preloadArrowMaterial();
    initEditor(controls, system, config, canvas);
    const loop = () => {
        requestAnimationFrame(loop);
        controls.update();
        system.updateSatellitesDisplay(controls);
        system.updateSOIsDisplay(controls);
        renderer.render(scene, camera);
    };
    requestAnimationFrame(loop);
}
