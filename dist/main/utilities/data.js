async function readTextFile(path) {
    const response = await fetch(path);
    const text = await response.text();
    return text;
}
export async function loadBodiesData() {
    const content = await readTextFile("./data/kspbodies.yml");
    const data = jsyaml.load(content);
    return {
        sun: data[0],
        bodies: data.slice(1)
    };
}
export async function loadConfig() {
    const content = await readTextFile("./data/config.yml");
    const config = jsyaml.load(content);
    return config;
}
