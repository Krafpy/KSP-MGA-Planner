export class SpriteManager {
    static loadSpriteMaterials() {
        const textureLoader = new THREE.TextureLoader();
        const loadingPromises = [];
        const loadSprite = (path, name) => {
            const promise = new Promise((resolve, _) => {
                textureLoader.load(path, (texture) => {
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
    static getMaterial(name) {
        const spriteMaterial = this._spriteMaterials.get(name);
        if (!spriteMaterial)
            throw new Error(`Cannot find sprite with name ${name}`);
        return spriteMaterial;
    }
}
SpriteManager._spriteMaterials = new Map();
