import { ConstVec3 } from "../../helpers/types";
import { THREE } from "../../three-usage";
import { EVoxelType, IVoxelMap } from "../i-voxel-map";
import * as Cube from "./cube";
import { PackedUintFactory } from "./uint-packing";

enum EMaterial {
    ROCK = 2,
    SAND = 3,
    GRASS = 1,
    GRASS_SAND = 0,
}

const packedUintFactory = new PackedUintFactory();
const encodedPosX = packedUintFactory.encodePart(128);
const encodedPosY = packedUintFactory.encodePart(64);
const encodedPosZ = packedUintFactory.encodePart(128);
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

enum EDisplayMode {
    TEXTURES,
    NORMALS,
    GREY,
}

class Patch {
    public static readonly maxPatchSize = new THREE.Vector3(encodedPosX.maxValue, encodedPosY.maxValue, encodedPosZ.maxValue);
    public static readonly maxSmoothEdgeRadius = 0.3;
    private static readonly dataAttributeName = "aData";

    private static material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
        glslVersion: "300 es",
        uniforms: {
            uDisplayMode: { value: 0 },
            uTexture: { value: new THREE.TextureLoader().load("resources/materials.png") },
            uAoStrength: { value: 0 },
            uAoSpread: { value: 0 },
            uSmoothEdgeRadius: { value: 0 },
            uSmoothEdgeMethod: { value: 0 },
            uAmbient: { value: 0 },
            uDiffuse: { value: 0 },
        },
        vertexShader: `
        in uint ${Patch.dataAttributeName};

        out vec2 vUv;
        out vec2 vEdgeRoundness;
        flat out vec3 vWorldFaceNormal;
        flat out uint vData;
        out float vAo;

        void main(void) {
            vec3 worldPosition = vec3(uvec3(
                ${encodedPosX.glslDecode(Patch.dataAttributeName)},
                ${encodedPosY.glslDecode(Patch.dataAttributeName)},
                ${encodedPosZ.glslDecode(Patch.dataAttributeName)}
            ));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
    
            const vec3 modelFaceNormals[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.normal.x},${face.normal.y},${face.normal.z})`).join(", ")}
            );
            uint faceId = ${encodedFaceId.glslDecode(Patch.dataAttributeName)};
            vWorldFaceNormal = modelFaceNormals[faceId];

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
        uniform float uAmbient;
        uniform float uDiffuse;
        uniform float uAoStrength;
        uniform float uAoSpread;
        uniform float uSmoothEdgeRadius;
        uniform uint uSmoothEdgeMethod;
        uniform uint uDisplayMode;

        in vec2 vUv;
        in vec2 vEdgeRoundness;
        flat in vec3 vWorldFaceNormal;
        flat in uint vData;
        in float vAo;

        out vec4 fragColor;

        vec3 computeModelNormal() {
            uint faceId = ${encodedFaceId.glslDecode("vData")};

            if (uSmoothEdgeRadius <= 0.0) {
                return vWorldFaceNormal;
            }
            
            vec3 localNormal;
    
            vec2 edgeRoundness = step(${Patch.maxSmoothEdgeRadius.toFixed(2)}, vEdgeRoundness);
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


            return localNormal.x * uvRight + localNormal.y * uvUp + localNormal.z * vWorldFaceNormal;
        }

        void main(void) {
            const ivec2 materials[] = ivec2[](
                ivec2(0,0),
                ivec2(8,0),
                ivec2(0,8),
                ivec2(8,8)
            );
            ivec2 material = materials[${encodedMaterial.glslDecode("vData")}];

            vec3 modelFaceNormal = computeModelNormal();

            vec3 color = vec3(0.75);
            if (uDisplayMode == ${EDisplayMode.TEXTURES}u) {
                ivec2 texelCoords = clamp(ivec2(vUv * 8.0), ivec2(0), ivec2(7)) + material;
                color = texelFetch(uTexture, texelCoords, 0).rgb;
            } else if (uDisplayMode == ${EDisplayMode.NORMALS}u) {
                color = 0.5 + 0.5 * modelFaceNormal;
            }
            
            const vec3 diffuseDirection = normalize(vec3(1, 1, 1));
            float diffuse = max(0.0, dot(modelFaceNormal, diffuseDirection));

            float light = uAmbient + uDiffuse * diffuse;
            float ao = (1.0 - uAoStrength) + uAoStrength * (smoothstep(0.0, uAoSpread, 1.0 - vAo));
            light *= ao;
            color *= light;

            fragColor = vec4(color, 1);
        }
        `,
    });

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
        readonly material: THREE.ShaderMaterial;
    } | null = null;

    public constructor(map: IVoxelMap, patchStart: THREE.Vector3, patchEnd: THREE.Vector3) {
        this.patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);

        const geometry = Patch.computeGeometry(map, patchStart, patchEnd);
        if (!geometry) {
            return;
        }

        const material = Patch.material.clone();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.translateX(patchStart.x);
        mesh.translateY(patchStart.y);
        mesh.translateZ(patchStart.z);
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

    private static computeGeometry(map: IVoxelMap, patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.BufferGeometry | null {
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);
        if (patchSize.x > encodedPosX.maxValue || patchSize.y > encodedPosY.maxValue || patchSize.z > encodedPosZ.maxValue) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${Patch.maxPatchSize})`);
        }

        const voxelsCountPerPatch = map.getMaxVoxelsCount(patchStart, patchEnd);
        if (voxelsCountPerPatch <= 0) {
            return null;
        }

        const maxFacesPerCube = 6;
        const verticesPerFace = 6;
        const uint32PerVertex = 1;
        const verticesData = new Uint32Array(voxelsCountPerPatch * maxFacesPerCube * verticesPerFace * uint32PerVertex);

        let iVertice = 0;
        for (const voxel of map.iterateOnVoxels(patchStart, patchEnd)) {
            const voxelX = voxel.position.x;
            const voxelY = voxel.position.y;
            const voxelZ = voxel.position.z;

            const iX = voxelX - patchStart.x;
            const iY = voxelY - patchStart.y;
            const iZ = voxelZ - patchStart.z;

            const faceVerticesData = new Uint32Array(4 * uint32PerVertex);
            for (const face of Object.values(Cube.faces)) {
                if (map.voxelExists(voxelX + face.normal.x, voxelY + face.normal.y, voxelZ + face.normal.z)) {
                    // this face will be hidden -> skip it
                    continue;
                }

                let faceMaterial: EMaterial;
                if (voxel.type === EVoxelType.ROCK) {
                    faceMaterial = EMaterial.ROCK;
                } else if (voxel.type === EVoxelType.DIRT) {
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

        const geometry = new THREE.BufferGeometry();
        const verticesDataBuffer = new THREE.Uint32BufferAttribute(verticesData.subarray(0, iVertice), 1, false);
        verticesDataBuffer.onUpload(() => { (verticesDataBuffer.array as THREE.TypedArray | null) = null; });
        geometry.setAttribute(Patch.dataAttributeName, verticesDataBuffer);
        geometry.setDrawRange(0, iVertice);
        geometry.boundingBox = new THREE.Box3(patchStart, patchEnd);
        const boundingSphere = new THREE.Sphere();
        geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(boundingSphere);
        return geometry;
    }
}

export {
    EDisplayMode,
    Patch
};

