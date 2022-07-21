
/*import { SolarSystem } from "./objects/system.js";
import { FlybySequenceGenerator } from "./solvers/sequence-solver.js";
import { TrajectorySolver } from "./solvers/trajectory-solver.js";
import { Trajectory } from "./solvers/trajectory.js";*/
import { initPageWithSystem } from "./page.js";
import { SpriteManager } from "./utilities/sprites.js";
import { WorkerManager } from "./utilities/worker.js";

window.onload = main;

async function main(){
    await SpriteManager.loadSpriteMaterials();

    const path = "dist/dedicated-workers/";
    WorkerManager.createPool(path + "trajectory-optimizer.js", "trajectory-optimizer");
    WorkerManager.createPool(path + "sequence-evaluator.js", "sequence-evaluator");
    WorkerManager.createWorker(path + "sequence-generator.js", "sequence-generator");

    initPageWithSystem();
}