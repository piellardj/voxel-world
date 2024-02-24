import { THREE } from "../../../../three-usage";
import { IVoxelMap } from "../../../i-voxel-map";
import { EDisplayMode, PatchMaterial } from "../../material";
import * as Cube from "../cube";
import { GeometryAndMaterial, PatchFactoryBase, VertexData } from "../factory-base";
import { VertexDataEncoder } from "./vertex-data-encoder";

class PatchFactoryMerged extends PatchFactoryBase {
    private static readonly dataAttributeName = "aData";

    private static readonly vertexDataEncoder = new VertexDataEncoder();

    public readonly maxPatchSize = new THREE.Vector3(
        PatchFactoryMerged.vertexDataEncoder.posX.maxValue,
        PatchFactoryMerged.vertexDataEncoder.posY.maxValue,
        PatchFactoryMerged.vertexDataEncoder.posZ.maxValue,
    );

    private readonly materialTemplate = new THREE.ShaderMaterial({
        glslVersion: "300 es",
        uniforms: this.uniformsTemplate,
        vertexShader: `
        in uint ${PatchFactoryMerged.dataAttributeName};

        out vec2 vUv;
        out vec2 vEdgeRoundness;
        flat out vec3 vWorldFaceNormal;
        flat out uint vData;
        flat out int vNoise;
        out float vAo;

        void main(void) {
            vec3 worldPosition = vec3(uvec3(
                ${PatchFactoryMerged.vertexDataEncoder.posX.glslDecode(PatchFactoryMerged.dataAttributeName)},
                ${PatchFactoryMerged.vertexDataEncoder.posY.glslDecode(PatchFactoryMerged.dataAttributeName)},
                ${PatchFactoryMerged.vertexDataEncoder.posZ.glslDecode(PatchFactoryMerged.dataAttributeName)}
            ));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
    
            const vec3 modelFaceNormals[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.normal.x},${face.normal.y},${face.normal.z})`).join(", ")}
            );
            uint faceId = ${PatchFactoryMerged.vertexDataEncoder.faceId.glslDecode(PatchFactoryMerged.dataAttributeName)};
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
            uint edgeRoundnessId = ${PatchFactoryMerged.vertexDataEncoder.edgeRoundness.glslDecode(PatchFactoryMerged.dataAttributeName)};
            vEdgeRoundness = edgeRoundness[edgeRoundnessId];

            vAo = float(${PatchFactoryMerged.vertexDataEncoder.ao.glslDecode(PatchFactoryMerged.dataAttributeName)}) / ${PatchFactoryMerged.vertexDataEncoder.ao.maxValue.toFixed(1)};

            int faceNumber = gl_VertexID / 6;
            vNoise = faceNumber % ${this.noiseTypes};
            vData = ${PatchFactoryMerged.dataAttributeName};
        }`,
        fragmentShader: `precision mediump float;

        uniform sampler2D uTexture;
        uniform sampler2D uNoiseTexture;
        uniform float uNoiseStrength;
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
        flat in int vNoise;
        in float vAo;

        out vec4 fragColor;

        vec3 computeModelNormal(const uint faceId) {
            if (uSmoothEdgeRadius <= 0.0) {
                return vWorldFaceNormal;
            }
            
            vec3 localNormal;
    
            vec2 edgeRoundness = step(${PatchFactoryBase.maxSmoothEdgeRadius.toFixed(2)}, vEdgeRoundness);
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

        float computeNoise() {
            ivec2 texelCoords = clamp(ivec2(vUv * ${this.noiseResolution.toFixed(1)}), ivec2(0), ivec2(${this.noiseResolution - 1}));
            texelCoords.x += vNoise * ${this.noiseResolution};
            float noise = texelFetch(uNoiseTexture, texelCoords, 0).r - 0.5;
            return uNoiseStrength * noise;
        }

        void main(void) {
            uint faceId = ${PatchFactoryMerged.vertexDataEncoder.faceId.glslDecode("vData")};
            
            vec3 modelFaceNormal = computeModelNormal(faceId);

            vec3 color = vec3(0.75);
            if (uDisplayMode == ${EDisplayMode.TEXTURES}u) {
                uint material = ${PatchFactoryMerged.vertexDataEncoder.voxelType.glslDecode("vData")};
                ivec2 texelCoords = ivec2(material, 0);
                color = texelFetch(uTexture, texelCoords, 0).rgb;
            } else if (uDisplayMode == ${EDisplayMode.NORMALS}u) {
                color = 0.5 + 0.5 * modelFaceNormal;
            }

            color += computeNoise();

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

    public constructor(map: IVoxelMap) {
        super(map, PatchFactoryMerged.vertexDataEncoder.voxelType);
    }

    protected disposeInternal(): void {
        this.materialTemplate.dispose();
    }

    protected computePatchData(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): GeometryAndMaterial[] {
        const voxelsCountPerPatch = this.map.getMaxVoxelsCount(patchStart, patchEnd);
        if (voxelsCountPerPatch <= 0) {
            return [];
        }

        const maxFacesPerCube = 6;
        const verticesPerFace = 6;
        const uint32PerVertex = 1;
        const verticesData = new Uint32Array(voxelsCountPerPatch * maxFacesPerCube * verticesPerFace * uint32PerVertex);

        let iVertice = 0;
        const faceVerticesData = new Uint32Array(4 * uint32PerVertex);
        for (const faceData of this.iterateOnVisibleFaces(patchStart, patchEnd)) {
            faceData.verticesData.forEach((faceVertexData: VertexData, faceVertexIndex: number) => {
                faceVerticesData[faceVertexIndex] = PatchFactoryMerged.vertexDataEncoder.encode(
                    faceData.voxelLocalPosition.x + faceVertexData.localPosition.x,
                    faceData.voxelLocalPosition.y + faceVertexData.localPosition.y,
                    faceData.voxelLocalPosition.z + faceVertexData.localPosition.z,
                    faceData.faceId,
                    faceData.voxelType,
                    faceVertexData.ao,
                    [faceVertexData.roundnessX, faceVertexData.roundnessY],
                );
            });

            for (const index of Cube.faceIndices) {
                verticesData[iVertice++] = faceVerticesData[index];
            }
        }

        const geometry = new THREE.BufferGeometry();
        const verticesDataBuffer = new THREE.Uint32BufferAttribute(verticesData.subarray(0, iVertice), 1, false);
        verticesDataBuffer.onUpload(() => { (verticesDataBuffer.array as THREE.TypedArray | null) = null; });
        geometry.setAttribute(PatchFactoryMerged.dataAttributeName, verticesDataBuffer);
        geometry.setDrawRange(0, iVertice);
        return [{ geometry, material: this.materialTemplate }];
    }
}

export {
    PatchFactoryMerged,
    type PatchMaterial
};

