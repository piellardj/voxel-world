import { THREE } from "../../../three-usage";
import { EVoxelType, IVoxelMap } from "../../i-voxel-map";
import { EDisplayMode, EMaterial, PatchMaterial, PatchMaterialUniforms } from "../material";
import { Patch } from "../patch";
import * as Cube from "./cube";
import { VertexDataEncoder } from "./vertex-data-encoder";

class PatchFactory {
    public static readonly maxSmoothEdgeRadius = 0.3;
    private static readonly dataAttributeName = "aData";

    private readonly vertexDataEncoder = new VertexDataEncoder();

    public readonly maxPatchSize = new THREE.Vector3(
        this.vertexDataEncoder.posX.maxValue,
        this.vertexDataEncoder.posY.maxValue,
        this.vertexDataEncoder.posZ.maxValue,
    );

    private readonly uniformsTemplate: PatchMaterialUniforms = {
        uDisplayMode: { value: 0 },
        uTexture: { value: new THREE.TextureLoader().load("resources/materials.png") },
        uAoStrength: { value: 0 },
        uAoSpread: { value: 0 },
        uSmoothEdgeRadius: { value: 0 },
        uSmoothEdgeMethod: { value: 0 },
        uAmbient: { value: 0 },
        uDiffuse: { value: 0 },
    };

    private readonly materialTemplate = new THREE.ShaderMaterial({
        glslVersion: "300 es",
        uniforms: this.uniformsTemplate,
        vertexShader: `
        in uint ${PatchFactory.dataAttributeName};

        out vec2 vUv;
        out vec2 vEdgeRoundness;
        flat out vec3 vWorldFaceNormal;
        flat out uint vData;
        out float vAo;

        void main(void) {
            vec3 worldPosition = vec3(uvec3(
                ${this.vertexDataEncoder.posX.glslDecode(PatchFactory.dataAttributeName)},
                ${this.vertexDataEncoder.posY.glslDecode(PatchFactory.dataAttributeName)},
                ${this.vertexDataEncoder.posZ.glslDecode(PatchFactory.dataAttributeName)}
            ));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
    
            const vec3 modelFaceNormals[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.normal.x},${face.normal.y},${face.normal.z})`).join(", ")}
            );
            uint faceId = ${this.vertexDataEncoder.faceId.glslDecode(PatchFactory.dataAttributeName)};
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
            uint edgeRoundnessId = ${this.vertexDataEncoder.edgeRoundness.glslDecode(PatchFactory.dataAttributeName)};
            vEdgeRoundness = edgeRoundness[edgeRoundnessId];

            vAo = float(${this.vertexDataEncoder.ao.glslDecode(PatchFactory.dataAttributeName)}) / ${this.vertexDataEncoder.ao.maxValue.toFixed(1)};

            vData = ${PatchFactory.dataAttributeName};
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
            uint faceId = ${this.vertexDataEncoder.faceId.glslDecode("vData")};

            if (uSmoothEdgeRadius <= 0.0) {
                return vWorldFaceNormal;
            }
            
            vec3 localNormal;
    
            vec2 edgeRoundness = step(${PatchFactory.maxSmoothEdgeRadius.toFixed(2)}, vEdgeRoundness);
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
            ivec2 material = materials[${this.vertexDataEncoder.material.glslDecode("vData")}];

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
    }) as unknown as PatchMaterial;

    private readonly map: IVoxelMap;

    public constructor(map: IVoxelMap) {
        this.map = map;
    }

    public buildPatch(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): Patch | null {
        const geometry = this.computeGeometry(patchStart, patchEnd);
        if (!geometry) {
            return null;
        }

        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);
        if (patchSize.x > this.maxPatchSize.x || patchSize.y > this.maxPatchSize.y || patchSize.z > this.maxPatchSize.z) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${this.maxPatchSize.x}x${this.maxPatchSize.y}x${this.maxPatchSize.z})`);
        }

        const material = this.materialTemplate.clone();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.translateX(patchStart.x);
        mesh.translateY(patchStart.y);
        mesh.translateZ(patchStart.z);
        return new Patch(patchSize, mesh, material);
    }

    public dispose(): void {
        this.materialTemplate.dispose();
    }

    private computeGeometry(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.BufferGeometry | null {
        const voxelsCountPerPatch = this.map.getMaxVoxelsCount(patchStart, patchEnd);
        if (voxelsCountPerPatch <= 0) {
            return null;
        }

        const maxFacesPerCube = 6;
        const verticesPerFace = 6;
        const uint32PerVertex = 1;
        const verticesData = new Uint32Array(voxelsCountPerPatch * maxFacesPerCube * verticesPerFace * uint32PerVertex);

        let iVertice = 0;
        for (const voxel of this.map.iterateOnVoxels(patchStart, patchEnd)) {
            const voxelX = voxel.position.x;
            const voxelY = voxel.position.y;
            const voxelZ = voxel.position.z;

            const iX = voxelX - patchStart.x;
            const iY = voxelY - patchStart.y;
            const iZ = voxelZ - patchStart.z;

            const faceVerticesData = new Uint32Array(4 * uint32PerVertex);
            for (const face of Object.values(Cube.faces)) {
                if (this.map.voxelExists(voxelX + face.normal.x, voxelY + face.normal.y, voxelZ + face.normal.z)) {
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
                    const [a, b, c] = faceVertex.shadowingNeighbourVoxels.map(neighbourVoxel => this.map.voxelExists(voxelX + neighbourVoxel.x, voxelY + neighbourVoxel.y, voxelZ + neighbourVoxel.z));
                    if (a && b) {
                        ao = 3;
                    } else {
                        ao = +a + +b + +c;
                    }

                    let roundnessX = true;
                    let roundnessY = true;
                    if (faceVertex.edgeNeighbourVoxels) {
                        for (const neighbourVoxel of faceVertex.edgeNeighbourVoxels.x) {
                            roundnessX &&= !this.map.voxelExists(voxelX + neighbourVoxel.x, voxelY + neighbourVoxel.y, voxelZ + neighbourVoxel.z);
                        }
                        for (const neighbourVoxel of faceVertex.edgeNeighbourVoxels.y) {
                            roundnessY &&= !this.map.voxelExists(voxelX + neighbourVoxel.x, voxelY + neighbourVoxel.y, voxelZ + neighbourVoxel.z);
                        }
                    }
                    faceVerticesData[faceVertexIndex] = this.vertexDataEncoder.encode(
                        faceVertex.vertex.x + iX, faceVertex.vertex.y + iY, faceVertex.vertex.z + iZ,
                        face.id,
                        faceMaterial,
                        ao,
                        [roundnessX, roundnessY],
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
        geometry.setAttribute(PatchFactory.dataAttributeName, verticesDataBuffer);
        geometry.setDrawRange(0, iVertice);
        geometry.boundingBox = new THREE.Box3(patchStart, patchEnd);
        const boundingSphere = new THREE.Sphere();
        geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(boundingSphere);
        return geometry;
    }
}

export {
    PatchFactory,
    type PatchMaterial
};

