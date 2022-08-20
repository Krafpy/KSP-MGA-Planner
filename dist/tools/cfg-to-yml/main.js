import { loadBodiesData } from "../../main/utilities/data.js";
import { completeBodytoUnorderedData, orderOrbitingBodies, parseToBodyConfig, parseToSunConfig, recomputeSOIs } from "./body-data.js";
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
    const combineChkBox = document.getElementById("combine-checkbox");
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
        let sun;
        if (sunConfig !== undefined) {
            const unorderedSun = parseToSunConfig(sunConfig, template);
            sun = { id: 0, ...unorderedSun };
        }
        else {
            if (!combineChkBox.checked) {
                throw new Error("Sun configuration not found.");
            }
            TextareaLogger.log("Using stock Sun");
            sun = template.get("Sun");
        }
        const orbitingUnordered = [];
        for (const config of configs) {
            if (config.Orbit) {
                const orbiting = parseToBodyConfig(config, template);
                orbitingUnordered.push(orbiting);
            }
        }
        if (combineChkBox.checked) {
            completeWithStock(orbitingUnordered, stockBodies.bodies, sun.name);
        }
        TextareaLogger.log(`Ordering...`);
        const orbiting = orderOrbitingBodies(orbitingUnordered, sun.name);
        TextareaLogger.log("Recomputing SOIs...");
        recomputeSOIs(orbiting, sun);
        TextareaLogger.log("Dumping to YAML");
        const sunYml = dumpSunToYaml(sun);
        const orbitingYml = orbiting.map(body => dumpBodyToYaml(body));
        const yml = joinYamlBlocks([sunYml, ...orbitingYml]);
        downloadBtn.onclick = () => download("bodies.yml", yml);
        TextareaLogger.log(`\nSuccessfully converted solar system data.`);
        TextareaLogger.log(`Click to download \`bodies.yml\``);
    };
    convertBtn.onclick = () => {
        convert().catch(reason => TextareaLogger.error(reason));
    };
}
function completeWithStock(unorderedOrbiting, stockOrbiting, sunName) {
    const definedOrbiting = new Set();
    for (const { data } of unorderedOrbiting) {
        definedOrbiting.add(data.name);
    }
    for (const body of stockOrbiting) {
        if (definedOrbiting.has(body.name))
            continue;
        TextareaLogger.log(`Using stock ${body.name}`);
        let referenceBody = sunName;
        if (body.orbiting != 0) {
            const idx = body.orbiting - 1;
            referenceBody = stockOrbiting[idx].name;
        }
        unorderedOrbiting.push({
            referenceBody,
            data: completeBodytoUnorderedData(body)
        });
    }
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
