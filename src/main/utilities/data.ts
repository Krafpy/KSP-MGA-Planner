async function readTextFile(path: string){
    const response = await fetch(path);
    const text = await response.text();
    return text;
}

export async function loadBodiesData(){
    const content = await readTextFile("./data/kspbodies.yml");
    const data = jsyaml.load(content) as object[];
    return {
        sun:    data[0]       as ICelestialBody,
        bodies: data.slice(1) as IOrbitingBody[]
    };
}

export async function loadConfig(){
    const content = await readTextFile("./data/config.yml");
    const config = jsyaml.load(content) as Config;
    return config;
}