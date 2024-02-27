import { Timer } from "../helpers/time/timer";
import { ConstVec3 } from "../helpers/types";
import { tryGetUrlNumber } from "../helpers/url-param";
import { THREE } from "../three-usage";
import { IVoxelMap } from "./i-voxel-map";
import { PatchFactoryBase } from "./patch/factory/factory-base";
import { PatchFactoryInstanced } from "./patch/factory/instanced/factory";
import { PatchFactoryMerged } from "./patch/factory/merged/factory";
import { PatchFactorySplit } from "./patch/factory/split/factory";
import { EDisplayMode, Patch } from "./patch/patch";

enum EPatchFactoryType {
    MERGED = "merged",
    INSTANCED = "instanced",
    MERGED_SPLIT = "merged_split",
}

class Terrain {
    public readonly container: THREE.Group;

    public readonly parameters = {
        voxels: {
            displayMode: EDisplayMode.TEXTURES,
            noiseStrength: 0.025,
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

    private readonly map: IVoxelMap;
    private readonly patchFactory: PatchFactoryBase;
    private readonly patchSize: ConstVec3;

    private readonly patches: Record<string, Patch | null> = {};

    public constructor(map: IVoxelMap, patchFactoryType: EPatchFactoryType) {
        this.map = map;
        if (patchFactoryType === EPatchFactoryType.MERGED) {
            this.patchFactory = new PatchFactoryMerged(map);
        } else if (patchFactoryType === EPatchFactoryType.INSTANCED) {
            this.patchFactory = new PatchFactoryInstanced(map);
        } else if (patchFactoryType === EPatchFactoryType.MERGED_SPLIT) {
            this.patchFactory = new PatchFactorySplit(map);
        } else {
            throw new Error();
        }

        this.patchSize = Terrain.computePatchSize(this.patchFactory.maxPatchSize);
        console.log(`Using max patch size ${this.patchSize.x}x${this.patchSize.y}x${this.patchSize.z}.`);

        this.container = new THREE.Group();
        // this.container.translateX(-0.5 * map.size.x);
        // this.container.translateZ(-0.5 * map.size.z);

        // if (map.size.x < 10) {
        //     this.container.translateY(-5);
        //     const scale = 10;
        //     this.container.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
        // } else {
        //     this.container.translateY(-10);
        //     const scale = 0.5;
        //     this.container.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
        // } 
    }

    public showEntireMap(): void {
        const computationStart = new Timer();
        const patchStart = new THREE.Vector3();
        for (patchStart.x = 0; patchStart.x < this.map.size.x; patchStart.x += this.patchSize.x) {
            for (patchStart.y = 0; patchStart.y < this.map.size.y; patchStart.y += this.patchSize.y) {
                for (patchStart.z = 0; patchStart.z < this.map.size.z; patchStart.z += this.patchSize.z) {
                    const patch = this.getPatch(patchStart);
                    if (patch) {
                        patch.container.visible = true;
                    }
                }
            }
        }
        console.log(`Computed all patches in ${computationStart.elapsed().toFixed()} ms`);
    }

    public showMapAroundPosition(position: ConstVec3, radius: number): void {
        const voxelFrom = new THREE.Vector3().copy(position).subScalar(radius);
        const voxelTo = new THREE.Vector3().copy(position).addScalar(radius);
        const patchIdFrom = voxelFrom.divide(this.patchSize).floor();
        const patchIdTo = voxelTo.divide(this.patchSize).ceil();

        for (const patch of Object.values(this.patches)) {
            if (patch) {
                patch.container.visible = false;
            }
        }

        const patchId = new THREE.Vector3();
        for (patchId.x = patchIdFrom.x; patchId.x < patchIdTo.x; patchId.x++) {
            for (patchId.y = patchIdFrom.y; patchId.y < patchIdTo.y; patchId.y++) {
                for (patchId.z = patchIdFrom.z; patchId.z < patchIdTo.z; patchId.z++) {
                    const patchStart = new THREE.Vector3().multiplyVectors(patchId, this.patchSize);
                    const patch = this.getPatch(patchStart);
                    if (patch) {
                        patch.container.visible = true;
                    }
                }
            }
        }
    }

    public updateUniforms(): void {
        for (const patch of Object.values(this.patches)) {
            if (patch) {
                patch.parameters.voxels.displayMode = this.parameters.voxels.displayMode;
                patch.parameters.voxels.noiseStrength = this.parameters.voxels.noiseStrength;

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
    }

    public clear(): void {
        for (const [patchId, patch] of Object.entries(this.patches)) {
            patch?.dispose();
            this.container.clear();
            delete this.patches[patchId];
        }
    }

    public dispose(): void {
        this.clear();
        this.patchFactory.dispose();
    }

    private getPatch(patchStart: THREE.Vector3): Patch | null {
        const patchId = this.computePatchId(patchStart);

        let patch = this.patches[patchId];
        if (typeof patch === "undefined") {
            const patchEnd = new THREE.Vector3().addVectors(patchStart, this.patchSize);

            const patchConstructorTimer = new Timer();
            patch = this.patchFactory.buildPatch(patchStart, patchEnd);
            if (patch) {
                console.log(`Generated patch of size ${patch.patchSize.x}x${patch.patchSize.y}x${patch.patchSize.z} in ${patchConstructorTimer.elapsed().toFixed(0)} ms.`);
                patch.container.visible = false;
                this.container.add(patch.container);
            }
            this.patches[patchId] = patch;
        }
        return patch;
    }

    private computePatchId(patchStart: ConstVec3): string {
        return `${patchStart.x / this.patchSize.x}_${patchStart.y / this.patchSize.y}_${patchStart.z / this.patchSize.z}`;
    }

    private static computePatchSize(factoryMaxPatchSize: THREE.Vector3): ConstVec3 {
        const patchSize = factoryMaxPatchSize.clone();
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
    EPatchFactoryType, Terrain
};

