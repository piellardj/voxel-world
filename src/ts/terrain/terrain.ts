import { THREE } from "../three-usage";
import { createNoise2D } from 'simplex-noise';

type Map = {
    readonly size: THREE.Vector3;
    readonly voxels: number[];
    readonly buildId: (x: number, z: number) => number;
};

class Terrain {
    public readonly group: THREE.Group;

    public constructor() {
        this.group = new THREE.Group();

        const map = Terrain.buildMap();
        this.fillGroup4(map);

        this.group.translateX(-0.5 * map.size.x);
        this.group.translateZ(-0.5 * map.size.z);
        this.group.translateY(-10);
        this.group.applyMatrix4(new THREE.Matrix4().makeScale(0.1, 0.1, 0.1));
    }

    private fillGroup1(map: Map): void {
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.buildId(iX, iZ);
                const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
                cube.translateX(iX);
                cube.translateY(iY);
                cube.translateZ(iZ);
                this.group.add(cube);
            }
        }
    }

    private fillGroup2(map: Map): void {
        const cubeGeometry = new THREE.BoxGeometry();
        const material = new THREE.MeshNormalMaterial();
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.buildId(iX, iZ);
                const cube = new THREE.Mesh(cubeGeometry, material);
                cube.translateX(iX);
                cube.translateY(iY);
                cube.translateZ(iZ);
                this.group.add(cube);
            }
        }
    }

    private fillGroup3(map: Map): void {
        const cube = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial(), map.size.x * map.size.z);
        this.group.add(cube);

        let index = 0;
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const iY = map.voxels[map.buildId(iX, iZ)];
                const matrix = new THREE.Matrix4().setPosition(new THREE.Vector3(iX, iY, iZ));
                cube.setMatrixAt(index++, matrix);
            }
        }
    }

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
                const iY = map.voxels[map.buildId(iX, iZ)];
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
                const mesh = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial());
                mesh.translateX(map.size.x * iX);
                mesh.translateZ(map.size.z * iZ);
                this.group.add(mesh);
                patchesCount++;
            }
        }

        console.log(`${(patchesCount * voxelsCountPerPatch).toLocaleString()} voxels in total.`);
    }

    private static buildMap(): Map {
        const size = new THREE.Vector3(1000, 10, 1000);

        const buildId = (x: number, z: number) => x * size.z + z;
        const noise2D = createNoise2D();

        const voxels: number[] = [];
        for (let iX = 0; iX < size.x; iX++) {
            for (let iZ = 0; iZ < size.z; iZ++) {
                const yNoise = 0.5 + 0.5 * noise2D(iX / 50, iZ / 50);
                const iY = Math.floor(yNoise * size.y);
                const id = buildId(iX, iZ);
                voxels[id] = iY;
            }
        }

        return {
            size,
            voxels,
            buildId,
        };
    }
}

export {
    Terrain
};

