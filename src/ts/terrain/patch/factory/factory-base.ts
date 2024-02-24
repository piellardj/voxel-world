import { THREE } from "../../../three-usage";
import type { IVoxelMap, IVoxelMaterial } from "../../i-voxel-map";
import type { PatchMaterial, PatchMaterialUniforms } from "../material";
import { Patch } from "../patch";
import type { PackedUintFragment } from "./uint-packing";

type GeometryAndMaterial = {
    readonly geometry: THREE.BufferGeometry;
    readonly material: PatchMaterial;
};

abstract class PatchFactoryBase {
    public static readonly maxSmoothEdgeRadius = 0.3;

    public abstract readonly maxPatchSize: THREE.Vector3;

    protected readonly map: IVoxelMap;

    private readonly texture: THREE.Texture;

    protected readonly uniformsTemplate: PatchMaterialUniforms = {
        uDisplayMode: { value: 0 },
        uTexture: { value: null },
        uAoStrength: { value: 0 },
        uAoSpread: { value: 0 },
        uSmoothEdgeRadius: { value: 0 },
        uSmoothEdgeMethod: { value: 0 },
        uAmbient: { value: 0 },
        uDiffuse: { value: 0 },
    };

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
        this.uniformsTemplate.uTexture.value = this.texture;
    }

    public buildPatch(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): Patch | null {
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);
        if (patchSize.x > this.maxPatchSize.x || patchSize.y > this.maxPatchSize.y || patchSize.z > this.maxPatchSize.z) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${this.maxPatchSize.x}x${this.maxPatchSize.y}x${this.maxPatchSize.z})`);
        }

        const patchData = this.computePatchData(patchStart, patchEnd);
        if (patchData.length === 0) {
            return null;
        }

        return new Patch(patchSize, patchData.map(patchData => {
            const material = patchData.material.clone();
            const mesh = new THREE.Mesh(patchData.geometry, material);
            mesh.frustumCulled = false;
            mesh.translateX(patchStart.x);
            mesh.translateY(patchStart.y);
            mesh.translateZ(patchStart.z);
            return { mesh, material };
        }));
    }

    public dispose(): void {
        this.disposeInternal();
        this.texture.dispose();
    }

    protected abstract computePatchData(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): GeometryAndMaterial[];

    protected abstract disposeInternal(): void;
};

export {
    PatchFactoryBase,
    type GeometryAndMaterial
};

