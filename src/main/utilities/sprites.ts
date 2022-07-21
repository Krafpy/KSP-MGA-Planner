export abstract class SpriteManager {
    private static readonly _spriteMaterials: Map<string, THREE.SpriteMaterial> = new Map<string, THREE.SpriteMaterial>();

    public static loadSpriteMaterials(){
        const textureLoader = new THREE.TextureLoader();
        const loadingPromises: Promise<boolean>[] = [];

        const loadSprite = (path: string, name: string) => {
            const promise = new Promise<boolean>((resolve, _) => {
                textureLoader.load(path, (texture: THREE.Texture) => {
                    const material = new THREE.SpriteMaterial({
                        map: texture
                    });
                    this._spriteMaterials.set(name, material);
                    resolve(true);
                });
            });
            loadingPromises.push(promise);
        };

        loadSprite("sprites/encounter.png", "encounter");
        loadSprite("sprites/encounter.png", "encounter");
        loadSprite("sprites/escape.png", "escape");
        loadSprite("sprites/maneuver.png", "maneuver");
        loadSprite("sprites/pod.png", "pod");
        loadSprite("sprites/circle-512.png", "circle");

        return Promise.all(loadingPromises);
    }

    public static getMaterial(name: string){
        const spriteMaterial = this._spriteMaterials.get(name);
        if(!spriteMaterial)
            throw new Error(`Cannot find sprite with name ${name}`);
        return spriteMaterial;
    }
}