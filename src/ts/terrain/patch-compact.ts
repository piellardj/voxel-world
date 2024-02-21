import { THREE } from "../three-usage";
import * as Cube from "./cube";
import { PackedUintFactory } from "./uint-packing";
import { EVoxelType, VoxelMap } from "./voxel-map";

enum EMaterial {
    ROCK = 2,
    SAND = 3,
    GRASS = 1,
    GRASS_SAND = 0,
};

const packedUintFactory = new PackedUintFactory();
const encodedPosX = packedUintFactory.encodePart(256);
const encodedPosY = packedUintFactory.encodePart(64);
const encodedPosZ = packedUintFactory.encodePart(256);
const encodedFaceId = packedUintFactory.encodePart(6);
const encodedMaterial = packedUintFactory.encodePart(Object.keys(EMaterial).length);
const encodedAo = packedUintFactory.encodePart(4);
const encodedEdgeRoundness = packedUintFactory.encodePart(4);

function encodeData(x: number, y: number, z: number, faceId: number, edgeRoundness: [boolean, boolean], materialCode: number, ao: number): number {
    return encodedPosX.encode(x) + encodedPosY.encode(y) + encodedPosZ.encode(z)
        + encodedFaceId.encode(faceId)
        + encodedEdgeRoundness.encode(+edgeRoundness[0] + (+edgeRoundness[1] << 1))
        + encodedMaterial.encode(materialCode)
        + encodedAo.encode(ao);
}

class Patch {
    public static readonly maxPatchSize: number = encodedPosX.maxValue;
    public static readonly dataAttributeName: string = "aData";

    public static readonly parameters = {
        smoothEdges: {
            enabled: true,
            radius: 0.1,
            maxRadius: 0.3, // is constant
            quality: 2,
        },
        ao: {
            enabled: true,
            strength: 0.4,
            spread: 0.85,
        },
        textures: {
            enabled: true,
        },
    };

    private static readonly textureMaterials = new THREE.TextureLoader().load("resources/materials.png");
    private static readonly textureWhite = new THREE.TextureLoader().load("resources/materials_white.png");

    private static material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
            uAoStrength: { value: 0 },
            uAoSpread: { value: 0 },
            uSmoothEdgeRadius: { value: 0 },
            uSmoothEdgeMethod: { value: 0 },
        },
        vertexShader: `
        attribute uint ${Patch.dataAttributeName};

        varying vec2 vUv;
        varying vec2 vEdgeRoundness;
        varying float vAo;
        flat varying uint vData;

        void main(void) {
            vec3 worldPosition = vec3(uvec3(
                ${encodedPosX.glslDecode(Patch.dataAttributeName)},
                ${encodedPosY.glslDecode(Patch.dataAttributeName)},
                ${encodedPosZ.glslDecode(Patch.dataAttributeName)}
            ));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
    
            const vec2 uvs[] = vec2[](
                vec2(0,0),
                vec2(1,0),
                vec2(0,1),
                vec2(0,1),
                vec2(1,0),
                vec2(1,1)
            );
            int faceVertexId = gl_VertexID % 6;
            vUv = uvs[faceVertexId];

            const vec2 edgeRoundness[] = vec2[](
                vec2(0,0),
                vec2(1,0),
                vec2(0,1),
                vec2(1,1)
            );
            uint edgeRoundnessId = ${encodedEdgeRoundness.glslDecode(Patch.dataAttributeName)};
            vEdgeRoundness = edgeRoundness[edgeRoundnessId];

            vAo = float(${encodedAo.glslDecode(Patch.dataAttributeName)}) / ${encodedAo.maxValue.toFixed(1)};

            vData = ${Patch.dataAttributeName};
        }`,
        fragmentShader: `precision mediump float;

        uniform sampler2D uTexture;
        uniform float uAoStrength;
        uniform float uAoSpread;
        uniform float uSmoothEdgeRadius;
        uniform uint uSmoothEdgeMethod;

        varying vec2 vUv;
        varying vec2 vEdgeRoundness;
        varying float vAo;
        flat varying uint vData;

        vec3 computeModelNormal() {
            uint faceId = ${encodedFaceId.glslDecode("vData")};

            const vec3 modelFaceNormals[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.normal.x},${face.normal.y},${face.normal.z})`).join(", ")}
            );
            vec3 modelFaceNormal = modelFaceNormals[faceId];

            if (uSmoothEdgeRadius <= 0.0) {
                return modelFaceNormal;
            }
            
            vec3 localNormal;
    
            vec2 edgeRoundness = step(${Patch.parameters.smoothEdges.maxRadius.toFixed(2)}, vEdgeRoundness);
            if (uSmoothEdgeMethod == 0u) {
                vec2 margin = mix(vec2(0), vec2(uSmoothEdgeRadius), edgeRoundness);
                vec3 roundnessCenter = vec3(clamp(vUv, margin, 1.0 - margin), -uSmoothEdgeRadius);
                localNormal = normalize(vec3(vUv, 0) - roundnessCenter);
            } else if (uSmoothEdgeMethod == 1u) {
                vec2 symetricUv = clamp(vUv - 0.5, -0.5,  0.5);
                vec2 distanceFromMargin = edgeRoundness * sign(symetricUv) * max(abs(symetricUv) - (0.5 - uSmoothEdgeRadius), 0.0) / uSmoothEdgeRadius;
                localNormal = normalize(vec3(distanceFromMargin, 1));
            } else if (uSmoothEdgeMethod == 2u) {
                vec2 symetricUv = clamp(vUv - 0.5, -0.5,  0.5);
                vec2 distanceFromMargin = edgeRoundness * sign(symetricUv) * max(abs(symetricUv) - (0.5 - uSmoothEdgeRadius), 0.0) / uSmoothEdgeRadius;
                distanceFromMargin = sign(distanceFromMargin) * distanceFromMargin * distanceFromMargin;
                localNormal = normalize(vec3(distanceFromMargin, 1));
            }

            const vec3 uvUps[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.uvUp.x},${face.uvUp.y},${face.uvUp.z})`).join(", ")}
            );
            vec3 uvUp = uvUps[faceId];

            const vec3 uvRights[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.uvRight.x},${face.uvRight.y},${face.uvRight.z})`).join(", ")}
            );
            vec3 uvRight = uvRights[faceId];


            return localNormal.x * uvRight + localNormal.y * uvUp + localNormal.z * modelFaceNormal;
        }

        void main(void) {
            const ivec2 materials[] = ivec2[](
                ivec2(0,0),
                ivec2(8,0),
                ivec2(0,8),
                ivec2(8,8)
            );
            ivec2 material = materials[${encodedMaterial.glslDecode("vData")}];

            ivec2 texel = clamp(ivec2(vUv * 8.0), ivec2(0), ivec2(7)) + material;
            vec3 color = texelFetch(uTexture, texel, 0).rgb;
            
            vec3 modelFaceNormal = computeModelNormal();
            color = 0.5 + 0.5 * modelFaceNormal;
            
            float light = 1.0;
            float ao = (1.0 - uAoStrength) + uAoStrength * (smoothstep(0.0, uAoSpread, 1.0 - vAo));
            light *= ao;
            color *= light;

            gl_FragColor = vec4(color, 1);
        }
        `,
    });

    public static updateUniforms(): void {
        Patch.material.uniforms.uTexture.value = Patch.parameters.textures.enabled ? Patch.textureMaterials : Patch.textureWhite;
        Patch.material.uniforms.uAoStrength.value = +Patch.parameters.ao.enabled * Patch.parameters.ao.strength;
        Patch.material.uniforms.uAoSpread.value = Patch.parameters.ao.spread;
        Patch.material.uniforms.uSmoothEdgeRadius.value = +Patch.parameters.smoothEdges.enabled * Patch.parameters.smoothEdges.radius;
        Patch.material.uniforms.uSmoothEdgeMethod.value = Patch.parameters.smoothEdges.quality;
    }

    public static buildPatchMesh(map: VoxelMap, patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.Mesh {
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);
        if (patchSize.x > encodedPosX.maxValue || patchSize.y > encodedPosY.maxValue || patchSize.z > encodedPosZ.maxValue) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${Patch.maxPatchSize})`);
        }
        const voxelsCountPerPatch = patchSize.x * patchSize.z;

        const maxFacesPerCube = 6;
        const verticesPerFace = 6;
        const uint32PerVertex = 1;
        const verticesData = new Uint32Array(voxelsCountPerPatch * maxFacesPerCube * verticesPerFace * uint32PerVertex);

        let iVertice = 0;
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

                const faceVerticesData = new Uint32Array(4 * uint32PerVertex);
                for (const face of Object.values(Cube.faces)) {
                    if (map.voxelExists(voxelX + face.normal.x, voxelY + face.normal.y, voxelZ + face.normal.z)) {
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

                    face.vertices.forEach((faceVertex: Cube.FaceVertex, faceVertexIndex: number) => {
                        let ao = 0;
                        const [a, b, c] = faceVertex.shadowingNeighbourVoxels.map(neighbourVoxel => map.voxelExists(voxelX + neighbourVoxel.x, voxelY + neighbourVoxel.y, voxelZ + neighbourVoxel.z));
                        if (a && b) {
                            ao = 3;
                        } else {
                            ao = +a + +b + +c;
                        }

                        let roundnessX = true;
                        let roundnessY = true;
                        if (faceVertex.edgeNeighbourVoxels) {
                            for (const neighbourVoxel of faceVertex.edgeNeighbourVoxels.x) {
                                roundnessX &&= !map.voxelExists(voxelX + neighbourVoxel.x, voxelY + neighbourVoxel.y, voxelZ + neighbourVoxel.z);
                            }
                            for (const neighbourVoxel of faceVertex.edgeNeighbourVoxels.y) {
                                roundnessY &&= !map.voxelExists(voxelX + neighbourVoxel.x, voxelY + neighbourVoxel.y, voxelZ + neighbourVoxel.z);
                            }
                        }
                        faceVerticesData[faceVertexIndex] = encodeData(
                            faceVertex.vertex.x + iX, faceVertex.vertex.y + iY, faceVertex.vertex.z + iZ,
                            face.id,
                            [roundnessX, roundnessY],
                            faceMaterial,
                            ao,
                        );
                    });

                    for (const index of Cube.faceIndices) {
                        verticesData[iVertice++] = faceVerticesData[index];
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const verticesDataBuffer = new THREE.Uint32BufferAttribute(verticesData.subarray(0, iVertice), 1, false);
        geometry.setAttribute(Patch.dataAttributeName, verticesDataBuffer);
        geometry.setDrawRange(0, iVertice);
        geometry.boundingBox = new THREE.Box3(patchStart, patchEnd);
        geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3().subVectors(patchEnd, patchStart).multiplyScalar(0.5),
            Math.sqrt(patchSize.x * patchSize.x + patchSize.y * patchSize.y + patchSize.z * patchSize.z)
        );

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

