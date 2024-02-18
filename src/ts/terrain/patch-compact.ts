import { THREE } from "../three-usage";
import { getAmbientOcclusion } from "./ambient-occlusion";
import * as Cube from "./cube";
import { EVoxelType, VoxelMap } from "./voxel-map";

type EncodedUintPart = {
    readonly maxValue: number;
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
            maxValue,
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

enum EMaterial {
    ROCK = 2,
    SAND = 3,
    GRASS = 1,
    GRASS_SAND = 0,
};

const encodingFactory = new EncodedUintFactory();
const encodedPosX = encodingFactory.encodePart(256);
const encodedPosY = encodingFactory.encodePart(64);
const encodedPosZ = encodingFactory.encodePart(256);
const encodedNormal = encodingFactory.encodePart(6);
const encodedUv = encodingFactory.encodePart(4);
const encodedMaterial = encodingFactory.encodePart(Object.keys(EMaterial).length);
const encodedAo = encodingFactory.encodePart(4);

function encodeData(x: number, y: number, z: number, normalCode: number, uvCode: number, materialCode: number, ao: number): number {
    return encodedPosX.encode(x) + encodedPosY.encode(y) + encodedPosZ.encode(z)
        + encodedNormal.encode(normalCode)
        + encodedUv.encode(uvCode)
        + encodedMaterial.encode(materialCode)
        + encodedAo.encode(ao);
}

class Patch {
    public static readonly maxPatchSize: number = encodedPosX.maxValue;
    public static readonly dataAttributeName: string = "aEncodedData";

    private static material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: new THREE.TextureLoader().load("resources/materials.png") },
        },
        vertexShader: `
        attribute uint ${Patch.dataAttributeName};

        flat varying vec3 vWorldNormal;
        varying float vAo;
        varying vec2 vUv;
        flat varying ivec2 vMaterial;

        void main(void) {
            vec3 position = vec3(uvec3(
                ${encodedPosX.glslDecode(Patch.dataAttributeName)},
                ${encodedPosY.glslDecode(Patch.dataAttributeName)},
                ${encodedPosZ.glslDecode(Patch.dataAttributeName)}
            ));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            vec3 normals[6] = vec3[](
                ${Cube.normals.map(normal => `vec3(${normal.normal.x},${normal.normal.y},${normal.normal.z})`).join(", ")}
            );
            uint normalCode = ${encodedNormal.glslDecode(Patch.dataAttributeName)};
            vWorldNormal = normals[normalCode];

            vAo = float(${encodedAo.glslDecode(Patch.dataAttributeName)}) / ${encodedAo.maxValue.toFixed(1)};
        
            vec2 uvs[4] = vec2[](
                vec2(0,0),
                vec2(0,1),
                vec2(1,0),
                vec2(1,1)
            );
            uint uvCode = ${encodedUv.glslDecode(Patch.dataAttributeName)};
            vUv = uvs[uvCode];

            ivec2 materials[4] = ivec2[](
                ivec2(0,0),
                ivec2(8,0),
                ivec2(0,8),
                ivec2(8,8)
            );
            uint materialCode = ${encodedMaterial.glslDecode(Patch.dataAttributeName)};
            vMaterial = materials[materialCode];
        }`,
        fragmentShader: `precision mediump float;

        uniform sampler2D uTexture;

        flat varying vec3 vWorldNormal;
        varying float vAo;
        varying vec2 vUv;
        flat varying ivec2 vMaterial;

        void main(void) {
             ivec2 texel = clamp(ivec2(vUv * 8.0), ivec2(0), ivec2(7)) + vMaterial;
            vec3 color = texelFetch(uTexture, texel, 0).rgb;

            const float maxAo = 0.5;
            float ao = (1.0 - maxAo) + maxAo * smoothstep(0.0, 0.95, 1.0 - vAo);
            color *= ao;
            gl_FragColor = vec4(color, 1);// * 0.0000000000000001 + vec4(vUv, 0, 1);
        }
        `,
    });

    public static buildPatchMesh(map: VoxelMap, patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.Mesh {
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);
        if (patchSize.x > encodedPosX.maxValue || patchSize.y > encodedPosY.maxValue || patchSize.z > encodedPosZ.maxValue) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${Patch.maxPatchSize})`);
        }
        const voxelsCountPerPatch = patchSize.x * patchSize.z;

        const encodedVerticesAndNormals = new Uint32Array(voxelsCountPerPatch * 6 * 4 * 1);
        const indices: number[] = new Array(voxelsCountPerPatch * 6 * 6);

        let iVertice = 0;
        let iIndex = 0;
        for (let iX = 0; iX < patchSize.x; iX++) {
            for (let iZ = 0; iZ < patchSize.z; iZ++) {
                const voxelX = patchStart.x + iX;
                const voxelZ = patchStart.z + iZ;
                const voxel = map.getVoxel(voxelX, voxelZ);
                if (!voxel) {
                    continue;
                }
                const voxelY = voxel.y;
                const iY = voxelY - patchStart.y;

                for (const face of Object.values(Cube.faces)) {
                    const faceNormal = face.normal;
                    if (map.voxelExists(voxelX + faceNormal.normal.x, voxelY + faceNormal.normal.y, voxelZ + faceNormal.normal.z)) {
                        // this face will be hidden -> skip it
                        continue;
                    }

                    let faceMaterial: EMaterial;
                    if (voxel.material === EVoxelType.ROCK) {
                        faceMaterial = EMaterial.ROCK;
                    } else if (voxel.material === EVoxelType.DIRT) {
                        if (face.type === "up") {
                            faceMaterial = EMaterial.GRASS;
                        } else if (face.type === "down") {
                            faceMaterial = EMaterial.SAND;
                        } else {
                            faceMaterial = EMaterial.GRASS_SAND;
                        }
                    } else {
                        throw new Error("Unknown material");
                    }

                    const firstVertexIndex = iVertice;
                    face.vertices.forEach((faceVertex: THREE.Vector3, vertexIndex: number) => {
                        const neighbourMmm = new THREE.Vector3(
                            iX + (faceVertex.x - 1),
                            iY + (faceVertex.y - 1),
                            iZ + (faceVertex.z - 1),
                        );

                        const ao = getAmbientOcclusion(
                            map.voxelExists(neighbourMmm.x + 0, neighbourMmm.y + 0, neighbourMmm.z + 0),
                            map.voxelExists(neighbourMmm.x + 0, neighbourMmm.y + 0, neighbourMmm.z + 1),
                            map.voxelExists(neighbourMmm.x + 0, neighbourMmm.y + 1, neighbourMmm.z + 0),
                            map.voxelExists(neighbourMmm.x + 0, neighbourMmm.y + 1, neighbourMmm.z + 1),
                            map.voxelExists(neighbourMmm.x + 1, neighbourMmm.y + 0, neighbourMmm.z + 0),
                            map.voxelExists(neighbourMmm.x + 1, neighbourMmm.y + 0, neighbourMmm.z + 1),
                            map.voxelExists(neighbourMmm.x + 1, neighbourMmm.y + 1, neighbourMmm.z + 0),
                            map.voxelExists(neighbourMmm.x + 1, neighbourMmm.y + 1, neighbourMmm.z + 1),
                        );

                        // if (ao > 0) {
                        //     console.log(ao);
                        // }
                        encodedVerticesAndNormals[iVertice++] = encodeData(
                            faceVertex.x + iX, faceVertex.y + iY, faceVertex.z + iZ,
                            face.normal.id,
                            vertexIndex,
                            faceMaterial,
                            ao,
                        );
                    });

                    for (const faceIndex of face.indices) {
                        indices[iIndex++] = faceIndex + firstVertexIndex;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const encodedPositionAndNormalCodeBuffer = new THREE.Uint32BufferAttribute(encodedVerticesAndNormals.subarray(0, iVertice), 1, false);
        geometry.setAttribute(Patch.dataAttributeName, encodedPositionAndNormalCodeBuffer);
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

