import { THREE } from "../../../three-usage";
import { IVoxelMap, IVoxelMaterial } from "../../i-voxel-map";
import { Patch } from "../patch";
import { PackedUintFragment } from "./uint-packing";

abstract class PatchFactoryBase {
    public static readonly maxSmoothEdgeRadius = 0.3;
    
    public abstract readonly maxPatchSize: THREE.Vector3;

    public abstract buildPatch(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): Patch | null;

    protected readonly map: IVoxelMap;

    protected readonly texture: THREE.Texture;

    protected constructor(map: IVoxelMap, voxelTypeEncoder: PackedUintFragment) {
        this.map = map;

        const voxelMaterials = this.map.getAllVoxelMaterials();
        const voxelTypesCount = voxelMaterials.length;
        const maxVoxelTypesSupported = voxelTypeEncoder.maxValue + 1;
        if (voxelTypesCount > maxVoxelTypesSupported) {
            throw new Error(`A map cannot have more than ${maxVoxelTypesSupported} voxel types (received ${voxelTypesCount}).`);
        }

        const textureWidth = voxelTypesCount;
        const textureHeight = 1;
        const textureData = new Uint8Array(4 * textureWidth * textureHeight);

        voxelMaterials.forEach((material: IVoxelMaterial, materialId: number) => {
            textureData[4 * materialId + 0] = 255 * material.color.r;
            textureData[4 * materialId + 1] = 255 * material.color.g;
            textureData[4 * materialId + 2] = 255 * material.color.b;
            textureData[4 * materialId + 3] = 255;
        });
        this.texture = new THREE.DataTexture(textureData, textureWidth, textureHeight);
        this.texture.needsUpdate = true;
    }

    public dispose(): void {
        this.disposeInternal();
        this.texture.dispose();
    }

    protected abstract disposeInternal(): void;
};

export {
    PatchFactoryBase
};

