import { createNoise2D } from 'simplex-noise';
import { ConstVec3 } from '../../helpers/types';
import { THREE } from "../../three-usage";
import { IVoxelMap, Voxel } from '../i-voxel-map';

enum EVoxelType {
    ROCK,
    GRASS,
}

type StoredVoxel = {
    readonly y: number;
    readonly type: EVoxelType;
};

class VoxelMap implements IVoxelMap {
    public readonly size: ConstVec3;
    private readonly voxels: ReadonlyArray<StoredVoxel>;

    public constructor(width: number, height: number, altitude: number) {
        this.size = new THREE.Vector3(width, altitude, height);

        const noise2D = createNoise2D();

        const voxels: StoredVoxel[] = [];
        for (let iX = 0; iX < this.size.x; iX++) {
            for (let iZ = 0; iZ < this.size.z; iZ++) {
                const yNoise = 0.5 + 0.5 * noise2D(iX / 50, iZ / 50);
                const iY = Math.floor(yNoise * this.size.y);
                const id = this.buildId(iX, iZ);
                voxels[id] = {
                    y: iY,
                    type: (iY > 0.25 * altitude) ? EVoxelType.GRASS : EVoxelType.ROCK,
                };
            }
        }
        this.voxels = voxels;

        console.log(`Generated map of size ${this.size.x}x${this.size.y}x${this.size.z} (${this.voxels.length.toLocaleString()} voxels).`);
    }

    public getVoxelTypesCount(): number {
        return Object.values(EVoxelType).length;
    }

    public getMaxVoxelsCount(from: ConstVec3, to: ConstVec3): number {
        const fromX = Math.max(from.x, 0);
        const fromZ = Math.max(from.z, 0);

        const toX = Math.min(to.x, this.size.x);
        const toZ = Math.min(to.z, this.size.z);

        return (toX - fromX) * (toZ - fromZ);
    }

    public *iterateOnVoxels(from: ConstVec3, to: ConstVec3): Generator<Voxel> {
        if (to.x < from.x || to.y < from.y || to.z < from.z) {
            throw new Error();
        }

        const position = new THREE.Vector3();
        for (position.x = from.x; position.x < to.x; position.x++) {
            for (position.z = from.z; position.z < to.z; position.z++) {
                const voxel = this.getVoxel(position.x, position.z);
                if (voxel) {
                    position.y = voxel.y;
                    if (from.y <= position.y && position.y < to.y) {
                        yield {
                            position,
                            type: voxel.type
                        };
                    }
                }
            }
        }
    }

    public voxelExists(x: number, y: number, z: number): boolean {
        const voxel = this.getVoxel(x, z);
        return voxel?.y === y;
    }

    private getVoxel(x: number, z: number): StoredVoxel | null {
        if (x >= 0 && x < this.size.x && z >= 0 && z < this.size.z) {
            const index = this.buildId(x, z);
            return this.voxels[index];
        }
        return null;
    }

    private buildId(x: number, z: number): number {
        return x * this.size.z + z;
    }
}

export {
    VoxelMap
};

