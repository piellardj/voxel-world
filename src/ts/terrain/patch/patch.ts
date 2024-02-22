import { ConstVec3 } from "../../helpers/types";
import { THREE } from "../../three-usage";
import { EDisplayMode, PatchMaterial } from "./material";

class Patch {
    public readonly container = new THREE.Object3D();

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

    public readonly patchSize: ConstVec3;
    private gpuResources: {
        readonly mesh: THREE.Mesh;
        readonly material: PatchMaterial;
    } | null = null;

    public constructor(patchSize: ConstVec3, mesh: THREE.Mesh, material: PatchMaterial) {
        this.patchSize = patchSize;
        this.gpuResources = { mesh, material };

        this.container = new THREE.Object3D();
        this.container.add(mesh);
    }

    public updateUniforms(): void {
        if (this.gpuResources) {
            this.gpuResources.material.uniforms.uAoStrength.value = +this.parameters.ao.enabled * this.parameters.ao.strength;
            this.gpuResources.material.uniforms.uAoSpread.value = this.parameters.ao.spread;
            this.gpuResources.material.uniforms.uSmoothEdgeRadius.value = +this.parameters.smoothEdges.enabled * this.parameters.smoothEdges.radius;
            this.gpuResources.material.uniforms.uSmoothEdgeMethod.value = this.parameters.smoothEdges.quality;
            this.gpuResources.material.uniforms.uDisplayMode.value = this.parameters.voxels.displayMode;
            this.gpuResources.material.uniforms.uAmbient.value = this.parameters.lighting.ambient;
            this.gpuResources.material.uniforms.uDiffuse.value = this.parameters.lighting.diffuse;
        }
    }

    public dispose(): void {
        if (this.gpuResources) {
            this.gpuResources.mesh.geometry.dispose();
            this.gpuResources.material.dispose();
            this.container.remove(this.gpuResources.mesh);
            this.gpuResources = null;
        }
    }
}

export {
    EDisplayMode,
    Patch
};

