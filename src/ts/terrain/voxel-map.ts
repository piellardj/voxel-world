import { createNoise2D } from 'simplex-noise';
import { THREE } from "../three-usage";

class VoxelMap {
    public readonly size: THREE.Vector3;
    private readonly voxels: ReadonlyArray<number>;

    public constructor(width: number, height: number, altitude: number) {
        this.size = new THREE.Vector3(width, altitude, height);

        const noise2D = createNoise2D();

        const voxels: number[] = [];
        for (let iX = 0; iX < this.size.x; iX++) {
            for (let iZ = 0; iZ < this.size.z; iZ++) {
                const yNoise = 0.5 + 0.5 * noise2D(iX / 50, iZ / 50);
                const iY = Math.floor(yNoise * this.size.y);
                const id = this.buildId(iX, iZ);
                voxels[id] = iY;
            }
        }
        this.voxels = voxels;
    }

    public getY(x: number, z: number): number{
        if (x >= 0 && x < this.size.x && z >= 0 && z < this.size.z) {
            const index = this.buildId(x, z);
            return this.voxels[index];
        }
        return -10000;
    };

    public getVoxel (x: number, y: number, z: number): boolean {
        const realY = this.getY(x, z);
        return realY === y;
    };

    private buildId(x: number, z: number): number {
        return x * this.size.z + z;
    }
}

export {
    VoxelMap,
};

