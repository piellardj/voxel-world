import { THREE } from "../three-usage";
import { VoxelMap } from "./voxel-map";

class Patch {
    private static material: THREE.Material = new THREE.MeshNormalMaterial();

    public static buildPatchMesh(map: VoxelMap, patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.Mesh {
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);

        const voxelsCountPerPatch = patchSize.x * patchSize.z;

        const vXpYpZp = new THREE.Vector3(+.5, +.5, +.5);
        const vXmYpZp = new THREE.Vector3(-.5, +.5, +.5);
        const vXpYmZp = new THREE.Vector3(+.5, -.5, +.5);
        const vXmYmZp = new THREE.Vector3(-.5, -.5, +.5);
        const vXpYpZm = new THREE.Vector3(+.5, +.5, -.5);
        const vXmYpZm = new THREE.Vector3(-.5, +.5, -.5);
        const vXpYmZm = new THREE.Vector3(+.5, -.5, -.5);
        const vXmYmZm = new THREE.Vector3(-.5, -.5, -.5);

        type Face = {
            vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
            normal: THREE.Vector3;
            indices: [number, number, number, number, number, number];
        };

        const faces: Record<"up" | "down" | "left" | "right" | "front" | "back", Face> = {
            up: {
                vertices: [vXmYpZm, vXmYpZp, vXpYpZm, vXpYpZp],
                normal: new THREE.Vector3(0, 1, 0),
                indices: [0, 1, 2, 1, 3, 2],
            },
            down: {
                vertices: [vXmYmZm, vXmYmZp, vXpYmZm, vXpYmZp],
                normal: new THREE.Vector3(0, -1, 0),
                indices: [0, 2, 1, 1, 2, 3],
            },
            left: {
                vertices: [vXmYmZp, vXmYpZp, vXmYmZm, vXmYpZm],
                normal: new THREE.Vector3(-1, 0, 0),
                indices: [0, 1, 2, 1, 3, 2],
            },
            right: {
                vertices: [vXpYmZp, vXpYpZp, vXpYmZm, vXpYpZm],
                normal: new THREE.Vector3(1, 0, 0),
                indices: [0, 2, 1, 1, 2, 3],
            },
            front: {
                vertices: [vXmYmZm, vXmYpZm, vXpYmZm, vXpYpZm],
                normal: new THREE.Vector3(0, 0, -1),
                indices: [0, 1, 2, 1, 3, 2],
            },
            back: {
                vertices: [vXmYmZp, vXmYpZp, vXpYmZp, vXpYpZp],
                normal: new THREE.Vector3(0, 0, 1),
                indices: [0, 2, 1, 1, 2, 3],
            },
        };

        const vertices = new Float32Array(voxelsCountPerPatch * 6 * 4 * 3);
        const normals = new Float32Array(voxelsCountPerPatch * 6 * 4 * 3);
        const indices: number[] = new Array(voxelsCountPerPatch * 6 * 6);

        let iVertice = 0;
        let iNormal = 0;
        let iIndex = 0;
        for (let iX = 0; iX < map.size.x; iX++) {
            for (let iZ = 0; iZ < map.size.z; iZ++) {
                const voxelX = patchStart.x + iX;
                const voxelZ = patchStart.z + iZ;
                const voxelY = map.getY(voxelX, voxelZ);
                const iY = voxelY - patchStart.y;

                for (const face of Object.values(faces)) {
                    if (map.getVoxel(voxelX + face.normal.x, voxelY + face.normal.y, voxelZ + face.normal.z)) {
                        // this face will be hidden -> skip it
                        continue;
                    }

                    const firstVertexIndex = iVertice / 3;

                    for (const faceVertex of face.vertices) {
                        vertices[iVertice++] = faceVertex.x + iX;
                        vertices[iVertice++] = faceVertex.y + iY;
                        vertices[iVertice++] = faceVertex.z + iZ;

                        normals[iNormal++] = face.normal.x;
                        normals[iNormal++] = face.normal.y;
                        normals[iNormal++] = face.normal.z;
                    }

                    for (const faceIndex of face.indices) {
                        indices[iIndex++] = faceIndex + firstVertexIndex;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const verticesBuffer = new THREE.Float32BufferAttribute(vertices.subarray(0, iVertice), 3, false);
        const normalsBuffer = new THREE.Float32BufferAttribute(normals.subarray(0, iNormal), 3, false);
        geometry.setAttribute("position", verticesBuffer);
        geometry.setAttribute("normal", normalsBuffer);
        geometry.setIndex(indices.slice(0, iIndex));
        const mesh = new THREE.Mesh(geometry, Patch.material);
        mesh.translateX(patchStart.x);
        mesh.translateY(patchStart.y);
        mesh.translateZ(patchStart.z);
        return mesh;
    }
}

export {
    Patch
};

