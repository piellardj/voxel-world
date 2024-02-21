enum EVoxelType {
    DIRT = 0,
    ROCK = 1,
}

type Uint3 = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

type Voxel = {
    readonly position: Uint3;
    readonly type: EVoxelType;
}

interface IVoxelMap {
    readonly size: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };

    getMaxVoxelsCount(from: Uint3, to: Uint3): number;
    iterateOnVoxels(from: Uint3, to: Uint3): Generator<Voxel>;
    voxelExists(x: number, y: number, z: number): boolean;
}

export {
    EVoxelType,
    IVoxelMap,
    Voxel
};

