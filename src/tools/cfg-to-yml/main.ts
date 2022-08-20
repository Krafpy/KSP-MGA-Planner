import { loadBodiesData } from "../../main/utilities/data.js";
import { completeBodytoUnorderedData, orderOrbitingBodies, parseToBodyConfig, parseToSunConfig, recomputeSOIs } from "./body-data.js";
import { parseConfigNodes } from "./cfg-parser.js";
import { dumpBodyToYaml, dumpSunToYaml, joinYamlBlocks } from "./dump.js";
import { readFilesFromInput } from "./file-reader.js";
import { TextareaLogger } from "./textarea-logger.js";

window.onload = main;

async function main(){
    const stockBodies = await loadBodiesData("stock", "./../../");
    const template = new Map<string, ICelestialBody | IOrbitingBody>();

    template.set(stockBodies.sun.name, stockBodies.sun);
    for(const body of stockBodies.bodies){
        template.set(body.name, body);
    }

    TextareaLogger.textarea = document.getElementById("log-box") as HTMLTextAreaElement;
    const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;
    const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
    const filesInput = document.getElementById("files-input") as HTMLInputElement;
    const combineChkBox = document.getElementById("combine-checkbox") as HTMLInputElement;

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
        let sun: ICelestialBody;
        if(sunConfig !== undefined){
            const unorderedSun = parseToSunConfig(sunConfig, template);
            sun = {id: 0, ...unorderedSun};
        } else {
            if(!combineChkBox.checked){
                throw new Error("Sun configuration not found.");
            }
            TextareaLogger.log("Using stock Sun");
            sun = template.get("Sun") as ICelestialBody;
        }

        // extract IOribitingBody_Unordered (without id and orbiting)
        // data for other bodies
        const orbitingUnordered: ParsedUnorderedOrbitingData[] = [];
        for(const config of configs){
            if(config.Orbit){ // if is an orbiting body
                const orbiting = parseToBodyConfig(config, template);
                orbitingUnordered.push(orbiting);
            }
        }

        // Combine with stock bodies, only add ones that have not been redefined
        // in a cfg file
        if(combineChkBox.checked){
            completeWithStock(orbitingUnordered, stockBodies.bodies, sun.name);
        }

        TextareaLogger.log(`Ordering...`);

        // Compute bodies's ids and sort them in the correct order
        const orbiting = orderOrbitingBodies(orbitingUnordered, sun.name);

        TextareaLogger.log("Recomputing SOIs...");

        recomputeSOIs(orbiting, sun); // recompute missing sois

        TextareaLogger.log("Dumping to YAML");

        // Convert to (beautified) yaml text
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

function completeWithStock(unorderedOrbiting: ParsedUnorderedOrbitingData[], stockOrbiting: IOrbitingBody[], sunName: string){
    const definedOrbiting = new Set<string>();
    for(const {data} of unorderedOrbiting) {
        definedOrbiting.add(data.name);
    }

    for(const body of stockOrbiting){
        if(definedOrbiting.has(body.name)) continue;

        TextareaLogger.log(`Using stock ${body.name}`);

        let referenceBody = sunName;
        if(body.orbiting != 0){
            const idx = body.orbiting - 1;
            referenceBody = stockOrbiting[idx].name;
        }
        unorderedOrbiting.push({
            referenceBody,
            data: completeBodytoUnorderedData(body)
        });
    }
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