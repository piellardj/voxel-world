import { getUrlNumber, tryGetUrlNumber } from "../helpers/url-param";
import { THREE } from "../three-usage";
import { EDisplayMode, Patch } from "./patch-compact";
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

    // @ts-ignore
    private fillGroup1(map: Map): void {
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.getY(iX, iZ);
                const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
                cube.translateX(iX);
                cube.translateY(iY);
                cube.translateZ(iZ);
                this.container.add(cube);
            }
        }
    }

    // @ts-ignore
    private fillGroup2(map: Map): void {
        const cubeGeometry = new THREE.BoxGeometry();
        const material = new THREE.MeshNormalMaterial();
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.getY(iX, iZ);
                const cube = new THREE.Mesh(cubeGeometry, material);
                cube.translateX(iX);
                cube.translateY(iY);
                cube.translateZ(iZ);
                this.container.add(cube);
            }
        }
    }

    // @ts-ignore
    private fillGroup3(map: Map): void {
        const cube = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial(), map.size.x * map.size.z);
        this.container.add(cube);

        let index = 0;
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.getY(iX, iZ);
                const matrix = new THREE.Matrix4().setPosition(new THREE.Vector3(iX, iY, iZ));
                cube.setMatrixAt(index++, matrix);
            }
        }
    }

    // @ts-ignore
    private fillGroup4(map: Map): void {
        const voxelsCountPerPatch = map.size.x * map.size.z;

        const exampleCube = new THREE.BoxGeometry();
        const exampleCubeVertices = exampleCube.getAttribute("position").array;
        const exampleCubeNormals = exampleCube.getAttribute("normal").array;
        const exampleCubeIndices = exampleCube.index!.array;

        const vertices = new Float32Array(voxelsCountPerPatch * exampleCubeVertices.length);
        const normals = new Float32Array(voxelsCountPerPatch * exampleCubeNormals.length);
        const indices = new Array(voxelsCountPerPatch * exampleCubeIndices.length);

        let iVertice = 0;
        let iNormal = 0;
        let iIndex = 0;
        let cubeIndex = 0;
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.getY(iX, iZ);
                for (let iV = 0; iV < exampleCubeVertices.length; iV += 3) {
                    vertices[iVertice++] = exampleCubeVertices[iV + 0] + iX;
                    vertices[iVertice++] = exampleCubeVertices[iV + 1] + iY;
                    vertices[iVertice++] = exampleCubeVertices[iV + 2] + iZ;

                    normals[iNormal++] = exampleCubeNormals[iV + 0];
                    normals[iNormal++] = exampleCubeNormals[iV + 1];
                    normals[iNormal++] = exampleCubeNormals[iV + 2];
                }

                for (const exampleCubeIndex of exampleCubeIndices) {
                    indices[iIndex++] = exampleCubeIndex + cubeIndex * exampleCubeVertices.length / 3;
                }
                cubeIndex++;
            }
        }

        const material = new THREE.MeshNormalMaterial();

        let patchesCount = 0;
        for (let iX = 0; iX < 2; iX++) {
            for (let iZ = 0; iZ < 2; iZ++) {
                const geometry = new THREE.BufferGeometry();
                const verticesBuffer = new THREE.Float32BufferAttribute(vertices, 3, false);
                const normalsBuffer = new THREE.Float32BufferAttribute(normals, 3, false);
                geometry.setAttribute("position", verticesBuffer);
                geometry.setAttribute("normal", normalsBuffer);
                geometry.setIndex(indices);
                const mesh = new THREE.Mesh(geometry, material);
                mesh.translateX(map.size.x * iX);
                mesh.translateZ(map.size.z * iZ);
                this.container.add(mesh);
                patchesCount++;
            }
        }

        console.log(`${(patchesCount * voxelsCountPerPatch).toLocaleString()} voxels in total.`);
    }
}

export {
    Terrain
};


