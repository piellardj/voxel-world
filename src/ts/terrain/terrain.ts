import { Timer } from "../helpers/time/timer";
import { ConstVec3 } from "../helpers/types";
import { tryGetUrlNumber } from "../helpers/url-param";
import { THREE } from "../three-usage";
import { IVoxelMap } from "./i-voxel-map";
import { PatchFactory } from "./patch/factory/factory";
import { PatchFactoryInstanced } from "./patch/factory/instanced/factory-instanced";
import { EDisplayMode, Patch } from "./patch/patch";

class Terrain {
    public readonly container: THREE.Group;

    public readonly parameters = {
        voxels: {
            displayMode: EDisplayMode.TEXTURES,
        },
        lighting: {
            ambient: 0.7,
            diffuse: 0.8,
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

    private readonly patchFactory: PatchFactory;
    private readonly patchFactoryInstanced: PatchFactoryInstanced;

    private readonly map: IVoxelMap;

    private patches: Patch[] = [];

    public constructor(map: IVoxelMap) {
        this.patchFactory = new PatchFactory(map);
        this.patchFactoryInstanced = new PatchFactoryInstanced(map);

        this.map = map;

        this.container = new THREE.Group();
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

    public computePatches(instanced: boolean): void {
        const factory = instanced ? this.patchFactoryInstanced : this.patchFactory;

        const patchSize = Terrain.computePatchSize(factory);
        console.log(`Using max patch size ${patchSize.x}x${patchSize.y}x${patchSize.z}.`);

        const computationStart = new Timer();
        const patchStart = new THREE.Vector3();
        for (patchStart.x = 0; patchStart.x < this.map.size.x; patchStart.x += patchSize.x) {
            for (patchStart.y = 0; patchStart.y < this.map.size.y; patchStart.y += patchSize.y) {
                for (patchStart.z = 0; patchStart.z < this.map.size.z; patchStart.z += patchSize.z) {
                    const patchEnd = new THREE.Vector3(
                        Math.min(this.map.size.x, patchStart.x + patchSize.x),
                        Math.min(this.map.size.y, patchStart.y + patchSize.y),
                        Math.min(this.map.size.z, patchStart.z + patchSize.z),
                    );

                    const patchConstructorTimer = new Timer();
                    const patch = factory.buildPatch(patchStart, patchEnd);
                    if (patch) {
                        console.log(`Generated patch of size ${patch.patchSize.x}x${patch.patchSize.y}x${patch.patchSize.z} in ${patchConstructorTimer.elapsed().toFixed(0)} ms.`);
                        this.patches.push(patch);
                        this.container.add(patch.container);
                    }
                }
            }
        }
        console.log(`Computed all patches in ${computationStart.elapsed().toFixed()} ms`);
    }

    public updateUniforms(): void {
        for (const patch of this.patches) {
            patch.parameters.voxels.displayMode = this.parameters.voxels.displayMode;

            patch.parameters.lighting.ambient = this.parameters.lighting.ambient;
            patch.parameters.lighting.diffuse = this.parameters.lighting.diffuse;

            patch.parameters.smoothEdges.enabled = this.parameters.smoothEdges.enabled;
            patch.parameters.smoothEdges.radius = this.parameters.smoothEdges.radius;
            patch.parameters.smoothEdges.quality = this.parameters.smoothEdges.quality;

            patch.parameters.ao.enabled = this.parameters.ao.enabled;
            patch.parameters.ao.strength = this.parameters.ao.strength;
            patch.parameters.ao.spread = this.parameters.ao.spread;
            patch.updateUniforms();
        }
    }

    public clear(): void {
        for (const patch of this.patches) {
            patch.dispose();
            this.container.clear();
        }
        this.patches = [];
    }

    public dispose(): void {
        this.clear();
        this.patchFactory.dispose();
        this.patchFactoryInstanced.dispose();
    }

    private static computePatchSize(factory: PatchFactory | PatchFactoryInstanced): ConstVec3 {
        const patchSize = factory.maxPatchSize.clone();
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

