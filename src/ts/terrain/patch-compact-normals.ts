import { THREE } from "../three-usage";
import { VoxelMap } from "./voxel-map";

const normalVectors = [
    new THREE.Vector3(0, +1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(+1, 0, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, +1),
];

class Patch {
    private static material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
        vertexShader: `
        attribute uint aNormal;

        flat varying vec3 vWorldNormal;
        
        void main(void) {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            vec3 normals[6] = vec3[](
                ${normalVectors.map(vec3 => `vec3(${vec3.x},${vec3.y},${vec3.z})`).join(", ")}
            );
            vWorldNormal = normals[aNormal];
        }`,
        fragmentShader: `precision mediump float;

        flat varying vec3 vWorldNormal;

        void main(void) {
            gl_FragColor = vec4(0.5 + 0.5 * vWorldNormal, 1);
        }
        `,
    });

    public static buildPatchMesh(map: VoxelMap, patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.Mesh {
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);

        const voxelsCountPerPatch = patchSize.x * patchSize.z;

        const vXpYpZp = new THREE.Vector3(1, 1, 1);
        const vXmYpZp = new THREE.Vector3(0, 1, 1);
        const vXpYmZp = new THREE.Vector3(1, 0, 1);
        const vXmYmZp = new THREE.Vector3(0, 0, 1);
        const vXpYpZm = new THREE.Vector3(1, 1, 0);
        const vXmYpZm = new THREE.Vector3(0, 1, 0);
        const vXpYmZm = new THREE.Vector3(1, 0, 0);
        const vXmYmZm = new THREE.Vector3(0, 0, 0);

        type Face = {
            vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
            normalCode: number;
            indices: [number, number, number, number, number, number];
        };

        const faces: Record<"up" | "down" | "left" | "right" | "front" | "back", Face> = {
            up: {
                vertices: [vXmYpZm, vXmYpZp, vXpYpZm, vXpYpZp],
                normalCode: 0,
                indices: [0, 1, 2, 1, 3, 2],
            },
            down: {
                vertices: [vXmYmZm, vXmYmZp, vXpYmZm, vXpYmZp],
                normalCode: 1,
                indices: [0, 2, 1, 1, 2, 3],
            },
            left: {
                vertices: [vXmYmZp, vXmYpZp, vXmYmZm, vXmYpZm],
                normalCode: 2,
                indices: [0, 1, 2, 1, 3, 2],
            },
            right: {
                vertices: [vXpYmZp, vXpYpZp, vXpYmZm, vXpYpZm],
                normalCode: 3,
                indices: [0, 2, 1, 1, 2, 3],
            },
            front: {
                vertices: [vXmYmZm, vXmYpZm, vXpYmZm, vXpYpZm],
                normalCode: 4,
                indices: [0, 1, 2, 1, 3, 2],
            },
            back: {
                vertices: [vXmYmZp, vXmYpZp, vXpYmZp, vXpYpZp],
                normalCode: 5,
                indices: [0, 2, 1, 1, 2, 3],
            },
        };

        const vertices = new Float32Array(voxelsCountPerPatch * 6 * 4 * 3);
        const normals = new Uint32Array(voxelsCountPerPatch * 6 * 4 * 1);
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
                    const faceNormal = normalVectors[face.normalCode]!;
                    if (map.getVoxel(voxelX + faceNormal.x, voxelY + faceNormal.y, voxelZ + faceNormal.z)) {
                        // this face will be hidden -> skip it
                        continue;
                    }

                    const firstVertexIndex = iVertice / 3;

                    for (const faceVertex of face.vertices) {
                        vertices[iVertice++] = faceVertex.x + iX;
                        vertices[iVertice++] = faceVertex.y + iY;
                        vertices[iVertice++] = faceVertex.z + iZ;

                        normals[iNormal++] = face.normalCode;
                    }

                    for (const faceIndex of face.indices) {
                        indices[iIndex++] = faceIndex + firstVertexIndex;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const verticesBuffer = new THREE.Float32BufferAttribute(vertices.subarray(0, iVertice), 3, false);
        const normalsBuffer = new THREE.Uint32BufferAttribute(normals.subarray(0, iNormal), 1, false);
        geometry.setAttribute("position", verticesBuffer);
        geometry.setAttribute("aNormal", normalsBuffer);
        geometry.setIndex(indices.slice(0, iIndex));

        const totalBytesSize = verticesBuffer.array.byteLength + normalsBuffer.array.byteLength;
        console.log(`Patch bytes size: ${totalBytesSize / 1024 / 1024} MB`);

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

