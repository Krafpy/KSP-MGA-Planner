import { loadBodiesData } from "../../main/utilities/data.js";
import { orderOrbitingBodies, parseToBodyConfig, parseToSunConfig, recomputeSOIs } from "./body-data.js";
import { parseConfigNodes } from "./cfg-parser.js";
import { dumpBodyToYaml, dumpSunToYaml, joinYamlBlocks } from "./dump.js";
import { readFilesFromInput } from "./file-reader.js";
import { TextareaLogger } from "./textarea-logger.js";
window.onload = main;
async function main() {
    const stockBodies = await loadBodiesData("stock", "./../../");
    const template = new Map();
    template.set(stockBodies.sun.name, stockBodies.sun);
    for (const body of stockBodies.bodies) {
        template.set(body.name, body);
    }
    TextareaLogger.textarea = document.getElementById("log-box");
    const convertBtn = document.getElementById("convert-btn");
    const downloadBtn = document.getElementById("download-btn");
    const filesInput = document.getElementById("files-input");
    const convert = async () => {
        var _a;
        if (!((_a = filesInput.files) === null || _a === void 0 ? void 0 : _a.length))
            return;
        TextareaLogger.clear();
        downloadBtn.onclick = null;
        TextareaLogger.log("Reading files content...");
        const files = await readFilesFromInput(filesInput);
        const configs = [];
        for (const { filename, content } of files) {
            TextareaLogger.log(`Parsing ${filename}`);
            configs.push(parseConfigNodes(content));
        }
        const sunConfig = configs.find(c => { var _a; return ((_a = c.Orbit) === null || _a === void 0 ? void 0 : _a.referenceBody) === undefined; });
        if (sunConfig === undefined) {
            throw new Error("Sun configuration not found.");
        }
        const unorderedSun = parseToSunConfig(sunConfig, template);
        const sun = { id: 0, ...unorderedSun };
        TextareaLogger.log(`Ordering...`);
        const orbitingUnordered = [];
        for (const config of configs) {
            if (config.Orbit) {
                const orbiting = parseToBodyConfig(config, template);
                orbitingUnordered.push(orbiting);
            }
        }
        const orbiting = orderOrbitingBodies(orbitingUnordered, sun.name);
        TextareaLogger.log("Recomputing SOIs...");
        recomputeSOIs(orbiting, sun);
        TextareaLogger.log("Dumping to YAML");
        const sunYml = dumpSunToYaml(sun);
        const orbitingYml = orbiting.map(body => dumpBodyToYaml(body));
        const yml = joinYamlBlocks([sunYml, ...orbitingYml]);
        TextareaLogger.log(`\nSuccessfully converted solar system data.`);
        downloadBtn.onclick = () => download("bodies.yml", yml);
        TextareaLogger.log(`Click to download \`bodies.yml\``);
    };
    convertBtn.onclick = () => {
        convert().catch(reason => TextareaLogger.error(reason));
    };
}
function download(filename, text) {
    const element = document.createElement('a');
    const encoded = encodeURIComponent(text);
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encoded);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
