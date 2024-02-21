import { ConstVec3 } from "../helpers/types";
import { tryGetUrlNumber } from "../helpers/url-param";
import { THREE } from "../three-usage";
import { IVoxelMap } from "./i-voxel-map";
import { EDisplayMode, Patch } from "./patch/patch";

class Terrain {
    public readonly container: THREE.Group;

    public readonly parameters = {
        voxels: {
            displayMode: EDisplayMode.TEXTURES,
        },
        smoothEdges: {
            enabled: true,
            radius: 0.1,
            quality: 2,
        },
        ao: {
            enabled: true,
            strength: 0.4,
            spread: 0.85,
        },
    };

    private patches: Patch[] = [];
    public constructor(map: IVoxelMap) {
        this.container = new THREE.Group();

        const patchSize = Terrain.computePatchSize();
        console.log(`Using max patch size ${patchSize.x}x${patchSize.y}x${patchSize.z}.`);

        const patchStart = new THREE.Vector3();
        for (patchStart.x = 0; patchStart.x < map.size.x; patchStart.x += patchSize.x) {
            for (patchStart.y = 0; patchStart.y < map.size.y; patchStart.y += patchSize.y) {
                for (patchStart.z = 0; patchStart.z < map.size.z; patchStart.z += patchSize.z) {
                    const patchEnd = new THREE.Vector3(
                        Math.min(map.size.x, patchStart.x + patchSize.x),
                        Math.min(map.size.y, patchStart.y + patchSize.y),
                        Math.min(map.size.z, patchStart.z + patchSize.z),
                    );

                    const startTimestamp = performance.now();
                    const patch = new Patch(map, patchStart, patchEnd);
                    console.log(`Generated patch of size ${patch.patchSize.x}x${patch.patchSize.y}x${patch.patchSize.z} in ${(performance.now() - startTimestamp).toFixed(1)} ms.`);
                    this.patches.push(patch);
                    this.container.add(patch.container);
                }
            }
        }

        this.container.translateX(-0.5 * map.size.x);
        this.container.translateZ(-0.5 * map.size.z);

        if (map.size.x < 10) {
            this.container.translateY(-5);
            const scale = 10;
            this.container.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
        } else {
            this.container.translateY(-10);
            const scale = 0.5;
            this.container.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
        }
    }

    public updateUniforms(): void {
        for (const patch of this.patches) {
            patch.parameters.voxels.displayMode = this.parameters.voxels.displayMode;

            patch.parameters.smoothEdges.enabled = this.parameters.smoothEdges.enabled;
            patch.parameters.smoothEdges.radius = this.parameters.smoothEdges.radius;
            patch.parameters.smoothEdges.quality = this.parameters.smoothEdges.quality;

            patch.parameters.ao.enabled = this.parameters.ao.enabled;
            patch.parameters.ao.strength = this.parameters.ao.strength;
            patch.parameters.ao.spread = this.parameters.ao.spread;
            patch.updateUniforms();
        }
    }

    public dispose(): void {
        for (const patch of this.patches) {
            patch.dispose();
        }
        this.patches = [];
    }

    private static computePatchSize(): ConstVec3 {
        const patchSize = Patch.maxPatchSize.clone();
        const patchSizeFromUrl = tryGetUrlNumber("patchsize");
        if (patchSizeFromUrl !== null) {
            patchSize.x = Math.min(patchSize.x, patchSizeFromUrl);
            // patchSize.y = Math.min(patchSize.y, patchSizeFromUrl);
            patchSize.z = Math.min(patchSize.z, patchSizeFromUrl);
        }
        if (patchSize.x * patchSize.y * patchSize.z === 0) {
            throw new Error(`Invalid patch size ${patchSize.x}x${patchSize.y}x${patchSize.z}.`);
        }
        return patchSize;
    }
}

export {
    Terrain
};

