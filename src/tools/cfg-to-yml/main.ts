import { loadBodiesData } from "../../main/utilities/data.js";
import { orderOrbitingBodies, parseToBodyConfig, parseToSunConfig, recomputeSOIs } from "./body-data.js";
import { parseConfigNodes } from "./cfg-parser.js";
import { dumpBodyToYaml, dumpSunToYaml, joinYamlBlocks } from "./dump.js";
import { readFilesFromInput } from "./file-reader.js";
import { TextareaLogger } from "./textarea-logger.js";

window.onload = main;

async function main(){
    const stockBodies = await loadBodiesData("stock");
    const template = new Map<string, ICelestialBody | IOrbitingBody>();

    template.set(stockBodies.sun.name, stockBodies.sun);
    for(const body of stockBodies.bodies){
        template.set(body.name, body);
    }

    TextareaLogger.textarea = document.getElementById("log-box") as HTMLTextAreaElement;
    const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;
    const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
    const filesInput = document.getElementById("files-input") as HTMLInputElement;

    const convert = async () => {
        if(!filesInput.files?.length) return;

        TextareaLogger.clear();
        downloadBtn.onclick = null;

        // Parse Kopernicus data from files
        TextareaLogger.log("Reading files content...");

        const files = await readFilesFromInput(filesInput);
        const configs = [];
        for(const {filename, content} of files){
            TextareaLogger.log(`Parsing ${filename}`); 
            configs.push(parseConfigNodes(content));
        }
        
        // extract ICelestiaBody data for the sun
        const sunConfig = configs.find(c => c.Orbit?.referenceBody === undefined);
        if(sunConfig === undefined){
            throw new Error("Sun configuration not found.");
        }
        const unorderedSun = parseToSunConfig(sunConfig, template);
        const sun: ICelestialBody = {id: 0, ...unorderedSun};

        TextareaLogger.log(`Ordering...`);

        // extract IOribitingBody_Unordered (without id and orbiting)
        // data for other bodies
        const orbitingUnordered: ParsedUnorderedOrbitingData[] = [];
        for(const config of configs){
            if(config.Orbit){ // if is an orbiting body
                const orbiting = parseToBodyConfig(config, template);
                orbitingUnordered.push(orbiting);
            }
        }

        // Compute bodies's ids and sort them in the correct order
        const orbiting = orderOrbitingBodies(orbitingUnordered, sun.name);

        TextareaLogger.log("Recomputing SOIs...");

        recomputeSOIs(orbiting, sun); // recompute missing sois

        TextareaLogger.log("Dumping to YAML");

        // Convert to (beautified) yaml text
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

function download(filename: string, text: string) {
    const element = document.createElement('a');
    const encoded = encodeURIComponent(text);
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encoded);
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }