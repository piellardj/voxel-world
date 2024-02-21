import { getUrlNumber, tryGetUrlNumber } from "../helpers/url-param";
import { THREE } from "../three-usage";
import { EDisplayMode, Patch } from "./patch";
import { VoxelMap } from "./voxel-map";

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
    public constructor() {
        this.container = new THREE.Group();

        const mapWidth = getUrlNumber("mapwidth", 256);
        const mapHeight = getUrlNumber("mapheight", 256);
        const map = new VoxelMap(mapWidth, mapHeight, 10);

        const patchSize = Terrain.computePatchSize();
        console.log(`Using patch size ${patchSize.x}x${patchSize.y}x${patchSize.z}.`);

        for (let iPatchX = 0; iPatchX < map.size.x; iPatchX += patchSize.x) {
            for (let iPatchZ = 0; iPatchZ < map.size.z; iPatchZ += patchSize.z) {
                const patchStart = new THREE.Vector3(iPatchX, 0, iPatchZ);
                const patchEnd = new THREE.Vector3(
                    Math.min(map.size.x, iPatchX + patchSize.x),
                    0,
                    Math.min(map.size.z, iPatchZ + patchSize.z),
                );

                const patch = new Patch(map, patchStart, patchEnd);
                this.patches.push(patch);
                this.container.add(patch.container);
            }
        }

        console.log(`${(mapWidth * mapHeight).toLocaleString()} voxels in total (${mapWidth}x${mapHeight})`);

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

    private static computePatchSize(): THREE.Vector3 {
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

