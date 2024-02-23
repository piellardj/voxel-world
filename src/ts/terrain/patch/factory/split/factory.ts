import { THREE } from "../../../../three-usage";
import { IVoxelMap, IVoxelMaterial } from "../../../i-voxel-map";
import { EDisplayMode, PatchMaterial, PatchMaterialUniforms } from "../../material";
import { Patch } from "../../patch";
import * as Cube from "../cube";
import { VertexDataEncoder } from "./vertex-data-encoder";

class PatchFactorySplit {
    public static readonly maxSmoothEdgeRadius = 0.3;
    private static readonly dataAttributeName = "aData";

    private readonly vertexDataEncoder = new VertexDataEncoder();

    public readonly maxPatchSize = new THREE.Vector3(
        this.vertexDataEncoder.voxelX.maxValue + 1,
        this.vertexDataEncoder.voxelY.maxValue + 1,
        this.vertexDataEncoder.voxelZ.maxValue + 1,
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

    private readonly materialsTemplates: Record<Cube.FaceType, PatchMaterial> = {
        up: this.buildPatchMaterial("up"),
        down: this.buildPatchMaterial("down"),
        left: this.buildPatchMaterial("left"),
        right: this.buildPatchMaterial("right"),
        front: this.buildPatchMaterial("front"),
        back: this.buildPatchMaterial("back"),
    };

    private buildPatchMaterial(faceType: Cube.FaceType): PatchMaterial {
        return new THREE.ShaderMaterial({
            glslVersion: "300 es",
            uniforms: this.uniformsTemplate,
            vertexShader: `
        in uint ${PatchFactorySplit.dataAttributeName};

        out vec2 vUv;
        out vec2 vEdgeRoundness;
        flat out uint vData;
        out float vAo;

        void main(void) {
            const uint vertexIds[] = uint[](${Cube.faceIndices.map(indice => `${indice}u`).join(", ")});
            uint vertexId = vertexIds[gl_VertexID % 6];

            uvec3 worldVoxelPosition = uvec3(
                ${this.vertexDataEncoder.voxelX.glslDecode(PatchFactorySplit.dataAttributeName)},
                ${this.vertexDataEncoder.voxelY.glslDecode(PatchFactorySplit.dataAttributeName)},
                ${this.vertexDataEncoder.voxelZ.glslDecode(PatchFactorySplit.dataAttributeName)}
            );

            const uvec3 localVertexPositions[] = uvec3[](
                ${Cube.faces[faceType].vertices.map(vertex => `uvec3(${vertex.vertex.x}, ${vertex.vertex.y}, ${vertex.vertex.z})`).join(",\n")}
            );
            uvec3 localVertexPosition = localVertexPositions[vertexId];
            vec3 worldPosition = vec3(worldVoxelPosition + localVertexPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);

            const vec2 uvs[] = vec2[](
                vec2(0,0),
                vec2(0,1),
                vec2(1,0),
                vec2(1,1)
            );
            vUv = uvs[vertexId];

            const vec2 edgeRoundness[] = vec2[](
                vec2(0,0),
                vec2(1,0),
                vec2(0,1),
                vec2(1,1)
            );
            uint edgeRoundnessId = ${this.vertexDataEncoder.edgeRoundness.glslDecode(PatchFactorySplit.dataAttributeName)};
            vEdgeRoundness = edgeRoundness[edgeRoundnessId];

            vAo = float(${this.vertexDataEncoder.ao.glslDecode(PatchFactorySplit.dataAttributeName)}) / ${this.vertexDataEncoder.ao.maxValue.toFixed(1)};

            vData = ${PatchFactorySplit.dataAttributeName};
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
        flat in uint vData;
        in float vAo;

        out vec4 fragColor;

        vec3 computeModelNormal() {
            const vec3 worldFaceNormal = vec3(${Cube.faces[faceType].normal.x.toFixed(1)}, ${Cube.faces[faceType].normal.y.toFixed(1)}, ${Cube.faces[faceType].normal.z.toFixed(1)});
            if (uSmoothEdgeRadius <= 0.0) {
                return worldFaceNormal;
            }
            
            vec3 localNormal;
    
            vec2 edgeRoundness = step(${PatchFactorySplit.maxSmoothEdgeRadius.toFixed(2)}, vEdgeRoundness);
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

            const vec3 uvUp = vec3(${Cube.faces[faceType].uvUp.x.toFixed(1)}, ${Cube.faces[faceType].uvUp.y.toFixed(1)}, ${Cube.faces[faceType].uvUp.z.toFixed(1)});
            const vec3 uvRight = vec3(${Cube.faces[faceType].uvRight.x.toFixed(1)}, ${Cube.faces[faceType].uvRight.y.toFixed(1)}, ${Cube.faces[faceType].uvRight.z.toFixed(1)});
            return localNormal.x * uvRight + localNormal.y * uvUp + localNormal.z * worldFaceNormal;
        }

        void main(void) {
            vec3 modelFaceNormal = computeModelNormal();

            vec3 color = vec3(0.75);
            if (uDisplayMode == ${EDisplayMode.TEXTURES}u) {
                uint material = ${this.vertexDataEncoder.voxelType.glslDecode("vData")};
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

            // color = vec3(vUv, 0);

            fragColor = vec4(color, 1);
        }
        `,
        }) as unknown as PatchMaterial;
    }

    private readonly map: IVoxelMap;

    public constructor(map: IVoxelMap) {
        this.map = map;

        const voxelMaterials = this.map.getAllVoxelMaterials();
        const voxelTypesCount = voxelMaterials.length;
        const maxVoxelTypesSupported = this.vertexDataEncoder.voxelType.maxValue + 1;
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
        const patchSize = new THREE.Vector3().subVectors(patchEnd, patchStart);
        if (patchSize.x > this.maxPatchSize.x || patchSize.y > this.maxPatchSize.y || patchSize.z > this.maxPatchSize.z) {
            throw new Error(`Patch is too big ${patchSize.x}x${patchSize.y}x${patchSize.z} (max is ${this.maxPatchSize.x}x${this.maxPatchSize.y}x${this.maxPatchSize.z})`);
        }

        const geometries = this.computeGeometries(patchStart, patchEnd);
        if (!geometries) {
            return null;
        }

        return new Patch(patchSize, Object.entries(geometries).map(value => {
            const faceType = value[0] as Cube.FaceType;
            const geometry = value[1];
            const material = this.materialsTemplates[faceType].clone();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            mesh.translateX(patchStart.x);
            mesh.translateY(patchStart.y);
            mesh.translateZ(patchStart.z);
            return {
                mesh,
                material,
            };
        }));
    }

    public dispose(): void {
        for (const material of Object.values(this.materialsTemplates)) {
            material.dispose();
        }
        this.texture.dispose();
    }

    private computeGeometries(patchStart: THREE.Vector3, patchEnd: THREE.Vector3): Record<Cube.FaceType, THREE.BufferGeometry> | null {
        const voxelsCountPerPatch = this.map.getMaxVoxelsCount(patchStart, patchEnd);
        if (voxelsCountPerPatch <= 0) {
            return null;
        }

        const verticesPerFace = 6;
        const uint32PerVertex = 1;

        const verticesData: Record<Cube.FaceType, Uint32Array> = {
            up: new Uint32Array(voxelsCountPerPatch * verticesPerFace * uint32PerVertex),
            down: new Uint32Array(voxelsCountPerPatch * verticesPerFace * uint32PerVertex),
            left: new Uint32Array(voxelsCountPerPatch * verticesPerFace * uint32PerVertex),
            right: new Uint32Array(voxelsCountPerPatch * verticesPerFace * uint32PerVertex),
            front: new Uint32Array(voxelsCountPerPatch * verticesPerFace * uint32PerVertex),
            back: new Uint32Array(voxelsCountPerPatch * verticesPerFace * uint32PerVertex),
        };

        let iVertice: Record<Cube.FaceType, number> = {
            up: 0,
            down: 0,
            left: 0,
            right: 0,
            front: 0,
            back: 0,
        };

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
                        iX, iY, iZ,
                        voxel.typeId,
                        ao,
                        [roundnessX, roundnessY],
                    );
                });

                for (const index of Cube.faceIndices) {
                    verticesData[face.type][iVertice[face.type]++] = faceVerticesData[index];
                }
            }
        }

        const geometries: Record<Cube.FaceType, THREE.BufferGeometry> = {
            up: new THREE.BufferGeometry(),
            down: new THREE.BufferGeometry(),
            left: new THREE.BufferGeometry(),
            right: new THREE.BufferGeometry(),
            front: new THREE.BufferGeometry(),
            back: new THREE.BufferGeometry(),
        };

        const boundingBox = new THREE.Box3(patchStart, patchEnd);
        const boundingSphere = new THREE.Sphere();
        boundingBox.getBoundingSphere(boundingSphere);

        for (const [faceType, geometry] of Object.entries(geometries) as [Cube.FaceType, THREE.BufferGeometry][]) {
            const faceVerticesData = verticesData[faceType];
            const faceIVertice = iVertice[faceType];
            const faceVerticesDataBuffer = new THREE.Uint32BufferAttribute(faceVerticesData.subarray(0, faceIVertice), 1, false);
            faceVerticesDataBuffer.onUpload(() => { (faceVerticesDataBuffer.array as THREE.TypedArray | null) = null; });
            geometry.setAttribute(PatchFactorySplit.dataAttributeName, faceVerticesDataBuffer);
            geometry.setDrawRange(0, faceIVertice);
            geometry.boundingBox = new THREE.Box3(patchStart, patchEnd);
            const boundingSphere = new THREE.Sphere();
            geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(boundingSphere);
        }

        return geometries;
    }
}

export {
    PatchFactorySplit,
    type PatchMaterial
};

