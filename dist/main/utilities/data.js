async function readTextFile(path) {
    const response = await fetch(path);
    const text = await response.text();
    return text;
}
export async function loadBodiesData(systemFolder) {
    const content = await readTextFile(`/data/${systemFolder}/bodies.yml`);
    const data = jsyaml.load(content);
    return {
        sun: data[0],
        bodies: data.slice(1)
    };
}
export async function loadConfig(systemFolder) {
    const content = await readTextFile(`/data/${systemFolder}/config.yml`);
    const config = jsyaml.load(content);
    return config;
}
export async function loadSystemsList() {
    const content = await readTextFile("/data/systems.yml");
    const systems = jsyaml.load(content);
    return systems;
}
