import { initEditor } from "./editor/editor.js";
import { SolarSystem } from "./objects/system.js";
import { CameraController } from "./objects/camera.js";
import { loadConfig, loadBodiesData } from "./utilities/data.js";

export async function initPageWithSystem(){
    const canvas = document.getElementById("three-canvas") as HTMLCanvasElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    const config = await loadConfig();

    const camera = new THREE.PerspectiveCamera(
        config.rendering.fov,
        width / height,
        config.rendering.nearPlane,
        config.rendering.farPlane
    );
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({antialias: true, canvas: canvas});
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const bodiesData = await loadBodiesData();
    const system = new SolarSystem(bodiesData.sun, bodiesData.bodies, config);
    system.fillSceneObjects(scene, canvas);
    
    const controls = new CameraController(camera, canvas, system, config);
    controls.targetBody = system.sun;
    
    let stop = false;
    let stopLoop = () => stop = false;

    initEditor(controls, system, config, canvas, stopLoop);

    const loop = () => {
        controls.update();
        system.update(controls);
        renderer.render(scene, camera);
        if(!stop){
            requestAnimationFrame(loop);
        }
    }

    requestAnimationFrame(loop);
}

export function clearWindow(scene: THREE.Scene){
    for(let i = scene.children.length - 1; i >= 0; i--) { 
        const obj = scene.children[i];
        scene.remove(obj);
    }
}