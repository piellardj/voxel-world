import { createNoise2D } from 'simplex-noise';
import { THREE } from "../three-usage";

enum EVoxelType {
    DIRT = 0,
    ROCK = 1,
}

type Voxel = {
    readonly y: number;
    readonly material: EVoxelType;
};

class VoxelMap {
    public readonly size: THREE.Vector3;
    private readonly voxels: ReadonlyArray<Voxel>;

    public constructor(width: number, height: number, altitude: number) {
        this.size = new THREE.Vector3(width, altitude, height);

        const noise2D = createNoise2D();

        const voxels: Voxel[] = [];
        for (let iX = 0; iX < this.size.x; iX++) {
            for (let iZ = 0; iZ < this.size.z; iZ++) {
                const yNoise = 0.5 + 0.5 * noise2D(iX / 50, iZ / 50);
                const iY = Math.floor(yNoise * this.size.y);
                const id = this.buildId(iX, iZ);
                voxels[id] = {
                    y: iY,
                    material: (iY > 0.25 * altitude) ? EVoxelType.DIRT : EVoxelType.ROCK,
                };
            }
        }
        this.voxels = voxels;
    }

    public getVoxel(x: number, z: number): Voxel | null {
        if (x >= 0 && x < this.size.x && z >= 0 && z < this.size.z) {
            const index = this.buildId(x, z);
            return this.voxels[index];
        }
        return null;
    };

    public voxelExists(x: number, y: number, z: number): boolean {
        const voxel = this.getVoxel(x, z);
        return voxel?.y === y;
    };

    private buildId(x: number, z: number): number {
        return x * this.size.z + z;
    }
}

export {
    EVoxelType, Voxel, VoxelMap
};

