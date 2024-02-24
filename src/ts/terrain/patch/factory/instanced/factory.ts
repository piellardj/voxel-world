import { THREE } from "../../../../three-usage";
import { IVoxelMap } from "../../../i-voxel-map";
import { EDisplayMode, PatchMaterial } from "../../material";
import * as Cube from "../cube";
import { GeometryAndMaterial, PatchFactoryBase, VertexData } from "../factory-base";
import { FaceDataEncoder } from "./face-data-encoder";
import { VertexDataEncoder } from "./vertex-data-encoder";

class PatchFactoryInstanced extends PatchFactoryBase {
    private static readonly faceDataAttributeName = "aData";
    private static readonly verticesDataAttributeName = "aVertices";

    private static readonly faceDataEncoder = new FaceDataEncoder();
    private static readonly vertexDataEncoder = new VertexDataEncoder();

    public readonly maxPatchSize = new THREE.Vector3(
        PatchFactoryInstanced.faceDataEncoder.voxelX.maxValue + 1,
        PatchFactoryInstanced.faceDataEncoder.voxelY.maxValue + 1,
        PatchFactoryInstanced.faceDataEncoder.voxelZ.maxValue + 1,
    );

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
                ${PatchFactoryInstanced.faceDataEncoder.voxelX.glslDecode(PatchFactoryInstanced.faceDataAttributeName)},
                ${PatchFactoryInstanced.faceDataEncoder.voxelY.glslDecode(PatchFactoryInstanced.faceDataAttributeName)},
                ${PatchFactoryInstanced.faceDataEncoder.voxelZ.glslDecode(PatchFactoryInstanced.faceDataAttributeName)}
            );

            const uint verticesId[] = uint[](${Cube.faceIndices.map(index => `${index}u`).join(", ")});
            uint vertexId = verticesId[gl_VertexID];
            uint vertexDataShift = ${PatchFactoryInstanced.vertexDataEncoder.bitsPerVertex}u * vertexId;

            uvec3 localVertexPosition = uvec3(
                ${PatchFactoryInstanced.vertexDataEncoder.localX.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")},
                ${PatchFactoryInstanced.vertexDataEncoder.localY.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")},
                ${PatchFactoryInstanced.vertexDataEncoder.localZ.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")}
            );
            
            vec3 worldVertexPosition = vec3(worldVoxelPosition + localVertexPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldVertexPosition, 1.0);
    
            const vec3 modelFaceNormals[] = vec3[](
                ${Cube.facesById.map(face => `vec3(${face.normal.x},${face.normal.y},${face.normal.z})`).join(", ")}
            );
            uint faceId = ${PatchFactoryInstanced.faceDataEncoder.faceId.glslDecode(PatchFactoryInstanced.faceDataAttributeName)};
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
            uint edgeRoundnessId = ${PatchFactoryInstanced.vertexDataEncoder.edgeRoundness.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")};
            vEdgeRoundness = edgeRoundness[edgeRoundnessId];

            vAo = float(${PatchFactoryInstanced.vertexDataEncoder.ao.glslDecodeWithShift(PatchFactoryInstanced.verticesDataAttributeName, "vertexDataShift")}) / ${PatchFactoryInstanced.vertexDataEncoder.ao.maxValue.toFixed(1)};

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

        void main(void) {
            uint faceId = ${PatchFactoryInstanced.faceDataEncoder.faceId.glslDecode("vData")};
            
            vec3 modelFaceNormal = computeModelNormal(faceId);

            vec3 color = vec3(0.75);
            if (uDisplayMode == ${EDisplayMode.TEXTURES}u) {
                uint material = ${PatchFactoryInstanced.faceDataEncoder.voxelType.glslDecode("vData")};
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

    public constructor(map: IVoxelMap) {
        super(map, PatchFactoryInstanced.faceDataEncoder.voxelType);
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
        const faceDataArray = new Uint32Array(voxelsCountPerPatch * maxFacesPerCube * 1);
        const verticesDataArray = new Uint8Array(voxelsCountPerPatch * maxFacesPerCube * 4);

        let iFace = 0;
        for (const faceData of this.iterateOnVisibleFaces(patchStart, patchEnd)) {
            faceDataArray[iFace] = PatchFactoryInstanced.faceDataEncoder.encode(
                faceData.voxelLocalPosition.x, faceData.voxelLocalPosition.y, faceData.voxelLocalPosition.z,
                faceData.faceId,
                faceData.voxelType,
            );

            faceData.verticesData.forEach((vertexData: VertexData, vertexIndex: number) => {
                verticesDataArray[4 * iFace + vertexIndex] = PatchFactoryInstanced.vertexDataEncoder.encode(
                    vertexData.localPosition.x, vertexData.localPosition.y, vertexData.localPosition.z,
                    vertexData.ao,
                    [vertexData.roundnessX, vertexData.roundnessY],
                );
            });

            iFace++;
        }

        const geometry = new THREE.InstancedBufferGeometry();
        geometry.instanceCount = iFace;
        geometry.setDrawRange(0, 6);

        {
            const faceDataArrayExact = faceDataArray.subarray(0, iFace);
            const faceBufferAttribute = new THREE.InstancedBufferAttribute(faceDataArrayExact, 1);
            faceBufferAttribute.onUpload(() => { (faceBufferAttribute.array as THREE.TypedArray | null) = null; });
            geometry.setAttribute(PatchFactoryInstanced.faceDataAttributeName, faceBufferAttribute);
        }
        {
            const verticesDataArrayExact = new Uint32Array(verticesDataArray.subarray(0, iFace).buffer);
            const verticesBufferAttribute = new THREE.InstancedBufferAttribute(verticesDataArrayExact, 1);
            verticesBufferAttribute.onUpload(() => { (verticesBufferAttribute.array as THREE.TypedArray | null) = null; });
            geometry.setAttribute(PatchFactoryInstanced.verticesDataAttributeName, verticesBufferAttribute);
        }

        geometry.boundingBox = new THREE.Box3(patchStart, patchEnd);
        const boundingSphere = new THREE.Sphere();
        geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(boundingSphere);
        return [{ geometry, material: this.materialTemplate }];
    }
}

export {
    PatchFactoryInstanced,
    type PatchMaterial
};

