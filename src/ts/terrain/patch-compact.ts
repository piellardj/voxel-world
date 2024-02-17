import { THREE } from "../three-usage";
import { VoxelMap } from "./voxel-map";

type EncodedUintPart = {
    encode(value: number): number;
    glslDecode(varname: string): string;
};

class EncodedUintFactory {
    private nextAvailableBit: number = 0;

    public encodePart(nbValues: number): EncodedUintPart {
        const shift = this.nextAvailableBit;
        const bitsCount = this.computeBitsNeeeded(nbValues);
        this.nextAvailableBit += bitsCount;
        if (this.nextAvailableBit > 32) {
            throw new Error("Does not fit");
        }
        const maxValue = (1 << bitsCount) - 1;

        return {
            encode: (value: number) => {
                if (value < 0 || value > maxValue) {
                    throw new Error("Out of range");
                }
                return value << shift;
            },
            glslDecode: (varname: string) => {
                return `((${varname} >> ${shift}u) & ${maxValue}u)`;
            },
        };
    }

    private computeBitsNeeeded(nbValues: number): number {
        for (let i = 1; i < 32; i++) {
            if (1 << i >= nbValues) {
                return i;
            }
        }
        throw new Error(`32 bits is not enough to store ${nbValues} values`);
    }
}

const encodingFactory = new EncodedUintFactory();
const encodedPosX = encodingFactory.encodePart(256);
const encodedPosY = encodingFactory.encodePart(64);
const encodedPosZ = encodingFactory.encodePart(256);
const encodedNormal = encodingFactory.encodePart(6);

const bytesPerPositionComponent = 8;
function encodePositionAndNormalCode(x: number, y: number, z: number, normalCode: number): number {
    return encodedPosX.encode(x) + encodedPosY.encode(y) + encodedPosZ.encode(z) + encodedNormal.encode(normalCode);
}

const normalVectors = [
    new THREE.Vector3(0, +1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(+1, 0, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, +1),
];

class Patch {
    public static readonly maxPatchSize: number = (1 << bytesPerPositionComponent) - 1;

    private static material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
        vertexShader: `
        attribute uint aEncodedVertexData;

        flat varying vec3 vWorldNormal;
        
        void main(void) {
            vec3 position = vec3(uvec3(
                ${encodedPosX.glslDecode("aEncodedVertexData")},
                ${encodedPosY.glslDecode("aEncodedVertexData")},
                ${encodedPosZ.glslDecode("aEncodedVertexData")}
            ));

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            vec3 normals[6] = vec3[](
                ${normalVectors.map(vec3 => `vec3(${vec3.x},${vec3.y},${vec3.z})`).join(", ")}
            );
            uint normalCode = ${encodedNormal.glslDecode("aEncodedVertexData")};
            vWorldNormal = normals[normalCode];
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
        if (Math.max(patchSize.x, patchSize.y, patchSize.z) > Patch.maxPatchSize) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${Patch.maxPatchSize})`);
        }
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

        const encodedVerticesAndNormals = new Uint32Array(voxelsCountPerPatch * 6 * 4 * 1);
        const indices: number[] = new Array(voxelsCountPerPatch * 6 * 6);

        let iVertice = 0;
        let iIndex = 0;
        for (let iX = 0; iX < patchSize.x; iX++) {
            for (let iZ = 0; iZ < patchSize.z; iZ++) {
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

                    const firstVertexIndex = iVertice;
                    for (const faceVertex of face.vertices) {
                        encodedVerticesAndNormals[iVertice++] = encodePositionAndNormalCode(
                            faceVertex.x + iX, faceVertex.y + iY, faceVertex.z + iZ,
                            face.normalCode
                        );
                    }

                    for (const faceIndex of face.indices) {
                        indices[iIndex++] = faceIndex + firstVertexIndex;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const encodedPositionAndNormalCodeBuffer = new THREE.Uint32BufferAttribute(encodedVerticesAndNormals.subarray(0, iVertice), 1, false);
        geometry.setAttribute("aEncodedVertexData", encodedPositionAndNormalCodeBuffer);
        geometry.setIndex(indices.slice(0, iIndex));

        // const totalBytesSize = encodedPositionAndNormalCodeBuffer.array.byteLength + iIndex * Uint32Array.BYTES_PER_ELEMENT;
        // console.log(`Patch bytes size: ${totalBytesSize / 1024 / 1024} MB`);

        const mesh = new THREE.Mesh(geometry, Patch.material);
        mesh.translateX(patchStart.x);
        mesh.translateY(patchStart.y);
        mesh.translateZ(patchStart.z);
        mesh.frustumCulled = false;
        return mesh;
    }
}

export {
    Patch
};

