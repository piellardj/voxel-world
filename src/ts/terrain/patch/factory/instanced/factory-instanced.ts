import { THREE } from "../../../../three-usage";
import { IVoxelMap, IVoxelMaterial } from "../../../i-voxel-map";
import { EDisplayMode, PatchMaterial, PatchMaterialUniforms } from "../../material";
import { Patch } from "../../patch";
import * as Cube from "../cube";
import { FaceDataEncoder } from "./face-data-encoder";
import { VertexDataEncoder } from "./vertex-data-encoder";

class PatchFactoryInstanced {
    public static readonly maxSmoothEdgeRadius = 0.3;
    private static readonly faceDataAttributeName = "aData";
    private static readonly verticesDataAttributeName = "aVertices";

    private readonly faceDataEncoder = new FaceDataEncoder();
    private readonly vertexDataEncoder = new VertexDataEncoder();

    public readonly maxPatchSize = new THREE.Vector3(
        this.faceDataEncoder.voxelX.maxValue + 1,
        this.faceDataEncoder.voxelY.maxValue + 1,
        this.faceDataEncoder.voxelZ.maxValue + 1,
    );

    private readonly texture: THREE.Texture;

    private readonly uniformsTemplate: PatchMaterialUniforms = {
        uDisplayMode: { value: 0 },
        uTexture: { value: null },
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
        in uint ${PatchFactoryInstanced.faceDataAttributeName};
        in uint ${PatchFactoryInstanced.verticesDataAttributeName};

        out vec2 vUv;
        out vec2 vEdgeRoundness;
        flat out vec3 vWorldFaceNormal;
        flat out uint vData;
        out float vAo;

        void main(void) {
            uvec3 worldVoxelPosition = uvec3(
                ${this.faceDataEncoder.voxelX.glslDecode(PatchFactoryInstanced.faceDataAttributeName)},
                ${this.faceDataEncoder.voxelY.glslDecode(PatchFactoryInstanced.faceDataAttributeName)},
                ${this.faceDataEncoder.voxelZ.glslDecode(PatchFactoryInstanced.faceDataAttributeName)}
            );

            const uint verticesId[] = uint[](${Cube.faceIndices.map(index => `${index}u`).join(", ")});
            uint vertexId = verticesId[gl_VertexID];
            uint vertexDataShift = ${this.vertexDataEncoder.bitsPerVertex}u * vertexId;

            uvec3 localVertexPosition = uvec3(
                ${this.vertexDataEncoder.localX.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")},
                ${this.vertexDataEncoder.localY.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")},
                ${this.vertexDataEncoder.localZ.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")}
            );
            
            vec3 worldVertexPosition = vec3(worldVoxelPosition + localVertexPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldVertexPosition, 1.0);
    
            const vec3 modelFaceNormals[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.normal.x},${face.normal.y},${face.normal.z})`).join(", ")}
            );
            uint faceId = ${this.faceDataEncoder.faceId.glslDecode(PatchFactoryInstanced.faceDataAttributeName)};
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
            uint edgeRoundnessId = ${this.vertexDataEncoder.edgeRoundness.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")};
            vEdgeRoundness = edgeRoundness[edgeRoundnessId];

            vAo = float(${this.vertexDataEncoder.ao.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")}) / ${this.vertexDataEncoder.ao.maxValue.toFixed(1)};

            vData = ${PatchFactoryInstanced.faceDataAttributeName};
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

        vec3 computeModelNormal(const uint faceId) {
            if (uSmoothEdgeRadius <= 0.0) {
                return vWorldFaceNormal;
            }
            
            vec3 localNormal;
    
            vec2 edgeRoundness = step(${PatchFactoryInstanced.maxSmoothEdgeRadius.toFixed(2)}, vEdgeRoundness);
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
            uint faceId = ${this.faceDataEncoder.faceId.glslDecode("vData")};
            
            vec3 modelFaceNormal = computeModelNormal(faceId);

            vec3 color = vec3(0.75);
            if (uDisplayMode == ${EDisplayMode.TEXTURES}u) {
                uint material = ${this.faceDataEncoder.voxelType.glslDecode("vData")};
                ivec2 texelCoords = ivec2(material, 0);
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

        const voxelMaterials = this.map.getAllVoxelMaterials();
        const voxelTypesCount = voxelMaterials.length;
        const maxVoxelTypesSupported = this.faceDataEncoder.voxelType.maxValue + 1;
        if (voxelTypesCount > maxVoxelTypesSupported) {
            throw new Error(`A map cannot have more than ${maxVoxelTypesSupported} voxel types (received ${voxelTypesCount}).`);
        }

        const textureWidth = voxelTypesCount;
        const textureHeight = 1;
        const textureData = new Uint8Array(4 * textureWidth * textureHeight);

        voxelMaterials.forEach((material: IVoxelMaterial, materialId: number) => {
            textureData[4 * materialId + 0] = 255 * material.color.r;
            textureData[4 * materialId + 1] = 255 * material.color.g;
            textureData[4 * materialId + 2] = 255 * material.color.b;
            textureData[4 * materialId + 3] = 255;
        });
        this.texture = new THREE.DataTexture(textureData, textureWidth, textureHeight);
        this.texture.needsUpdate = true;
        this.uniformsTemplate.uTexture.value = this.texture;
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
        return new Patch(patchSize, [{ mesh, material }]);
    }

    public dispose(): void {
        this.materialTemplate.dispose();
        // this.texture.dispose();
    }

    private computeGeometry(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): THREE.BufferGeometry | null {
        const voxelsCountPerPatch = this.map.getMaxVoxelsCount(patchStart, patchEnd);
        if (voxelsCountPerPatch <= 0) {
            return null;
        }

        const maxFacesPerCube = 6;
        const faceData = new Uint32Array(voxelsCountPerPatch * maxFacesPerCube * 1);
        const verticesData = new Uint8Array(voxelsCountPerPatch * maxFacesPerCube * 4);

        let iFace = 0;
        for (const voxel of this.map.iterateOnVoxels(patchStart, patchEnd)) {
            const voxelX = voxel.position.x;
            const voxelY = voxel.position.y;
            const voxelZ = voxel.position.z;

            const iX = voxelX - patchStart.x;
            const iY = voxelY - patchStart.y;
            const iZ = voxelZ - patchStart.z;

            for (const face of Object.values(Cube.faces)) {
                if (this.map.voxelExists(voxelX + face.normal.x, voxelY + face.normal.y, voxelZ + face.normal.z)) {
                    // this face will be hidden -> skip it
                    continue;
                }

                faceData[iFace] = this.faceDataEncoder.encode(
                    iX, iY, iZ,
                    face.id,
                    voxel.typeId,
                );

                face.vertices.forEach((faceVertex: Cube.FaceVertex, vertexIndex: number) => {
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

                    verticesData[4 * iFace + vertexIndex] = this.vertexDataEncoder.encode(
                        faceVertex.vertex.x, faceVertex.vertex.y, faceVertex.vertex.z,
                        ao,
                        [roundnessX, roundnessY],
                    );
                });

                iFace++;
            }
        }

        const geometry = new THREE.InstancedBufferGeometry();
        geometry.instanceCount = iFace;
        geometry.setDrawRange(0, 6);

        {
            const faceDataArray = faceData.subarray(0, iFace);
            const faceBufferAttribute = new THREE.InstancedBufferAttribute(faceDataArray, 1);
            faceBufferAttribute.onUpload(() => { (faceBufferAttribute.array as THREE.TypedArray | null) = null; });
            geometry.setAttribute(PatchFactoryInstanced.faceDataAttributeName, faceBufferAttribute);
        }
        {
            const verticesDataArray = new Uint32Array(verticesData.subarray(0, iFace).buffer);
            const verticesBufferAttribute = new THREE.InstancedBufferAttribute(verticesDataArray, 1);
            verticesBufferAttribute.onUpload(() => { (verticesBufferAttribute.array as THREE.TypedArray | null) = null; });
            geometry.setAttribute(PatchFactoryInstanced.verticesDataAttributeName, verticesBufferAttribute);
        }

        geometry.boundingBox = new THREE.Box3(patchStart, patchEnd);
        const boundingSphere = new THREE.Sphere();
        geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(boundingSphere);
        return geometry;
    }
}

export {
    PatchFactoryInstanced,
    type PatchMaterial
};

