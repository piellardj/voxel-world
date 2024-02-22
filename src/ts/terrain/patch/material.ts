enum EMaterial {
    ROCK = 2,
    SAND = 3,
    GRASS = 1,
    GRASS_SAND = 0,
}

enum EDisplayMode {
    TEXTURES,
    NORMALS,
    GREY,
}

type PatchMaterialUniforms = {
    readonly uDisplayMode: { value: EDisplayMode };
    readonly uTexture: { value: THREE.Texture };
    readonly uAoStrength: { value: number };
    readonly uAoSpread: { value: number };
    readonly uSmoothEdgeRadius: { value: number };
    readonly uSmoothEdgeMethod: { value: number };
    readonly uAmbient: { value: number };
    readonly uDiffuse: { value: number };
};

type PatchMaterial = THREE.Material & {
    readonly uniforms: PatchMaterialUniforms;
};

export {
    EDisplayMode,
    EMaterial,
    type PatchMaterial,
    type PatchMaterialUniforms
};

