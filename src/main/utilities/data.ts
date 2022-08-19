async function readTextFile(path: string){
    const response = await fetch(path);
    const text = await response.text();
    return text;
}

export async function loadBodiesData(systemFolder: string){
    const content = await readTextFile(`/data/${systemFolder}/bodies.yml`);
    const data = jsyaml.load(content) as object[];
    return {
        sun:    data[0]       as ICelestialBody,
        bodies: data.slice(1) as IOrbitingBody[]
    };
}

export async function loadConfig(systemFolder: string){
    const content = await readTextFile(`/data/${systemFolder}/config.yml`);
    const config = jsyaml.load(content) as Config;
    return config;
}

export async function loadSystemsList(){
    const content = await readTextFile("/data/systems.yml");
    const systems = jsyaml.load(content) as SolarSystemData[];
    return systems;
}