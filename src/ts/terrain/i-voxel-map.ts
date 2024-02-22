type Uint3 = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

type VoxelMaterial = number;

type Voxel = {
    readonly position: Uint3;
    readonly type: VoxelMaterial;
}

interface IVoxelMap {
    readonly size: Uint3;

    getVoxelTypesCount(): number;
    getMaxVoxelsCount(from: Uint3, to: Uint3): number;
    iterateOnVoxels(from: Uint3, to: Uint3): Generator<Voxel>;
    voxelExists(x: number, y: number, z: number): boolean;
}

export type {
    IVoxelMap,
    Voxel
};

