import { THREE } from "../three-usage";

const vertices = {
    ppp: new THREE.Vector3(1, 1, 1),
    mpp: new THREE.Vector3(0, 1, 1),
    pmp: new THREE.Vector3(1, 0, 1),
    mmp: new THREE.Vector3(0, 0, 1),
    ppm: new THREE.Vector3(1, 1, 0),
    mpm: new THREE.Vector3(0, 1, 0),
    pmm: new THREE.Vector3(1, 0, 0),
    mmm: new THREE.Vector3(0, 0, 0),
};
type FaceVertex = {
    readonly vertex: THREE.Vector3;
    readonly neighbourVoxels: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
};

type FaceType = "up" | "down" | "left" | "right" | "front" | "back";

type FaceNormal = {
    readonly id: number;
    readonly vector: THREE.Vector3;
};
let iN = 0;
const normals: Record<FaceType, FaceNormal> = {
    up: { id: iN++, vector: new THREE.Vector3(0, +1, 0) },
    down: { id: iN++, vector: new THREE.Vector3(0, -1, 0) },
    left: { id: iN++, vector: new THREE.Vector3(-1, 0, 0) },
    right: { id: iN++, vector: new THREE.Vector3(+1, 0, 0) },
    front: { id: iN++, vector: new THREE.Vector3(0, 0, +1) },
    back: { id: iN++, vector: new THREE.Vector3(0, 0, -1) },
};
const normalsById = Object.values(normals).sort((normal1: FaceNormal, normal2: FaceNormal) => normal1.id - normal2.id);

type Face = {
    readonly type: FaceType;
    readonly vertices: [FaceVertex, FaceVertex, FaceVertex, FaceVertex];
    readonly normal: FaceNormal;
};

const faceIndices: [number, number, number, number, number, number] = [0, 2, 1, 1, 2, 3];

const faces: Record<FaceType, Face> = {
    up: {
        type: "up",
        vertices: [
            {
                vertex: vertices.ppm,
                neighbourVoxels: [new THREE.Vector3(1, 1, 0), new THREE.Vector3(0, 1, -1), new THREE.Vector3(1, 1, -1)],
            },
            {
                vertex: vertices.ppp,
                neighbourVoxels: [new THREE.Vector3(1, 1, 0), new THREE.Vector3(0, 1, 1), new THREE.Vector3(1, 1, 1)],
            },
            {
                vertex: vertices.mpm,
                neighbourVoxels: [new THREE.Vector3(-1, 1, 0), new THREE.Vector3(0, 1, -1), new THREE.Vector3(-1, 1, -1)],
            },
            {
                vertex: vertices.mpp,
                neighbourVoxels: [new THREE.Vector3(-1, 1, 0), new THREE.Vector3(0, 1, 1), new THREE.Vector3(-1, 1, 1)],
            },
        ],
        normal: normals.up,
    },
    down: {
        type: "down",
        vertices: [
            {
                vertex: vertices.mmm,
                neighbourVoxels: [new THREE.Vector3(-1, -1, 0), new THREE.Vector3(0, -1, -1), new THREE.Vector3(-1, -1, -1)],
            },
            {
                vertex: vertices.mmp,
                neighbourVoxels: [new THREE.Vector3(-1, -1, 0), new THREE.Vector3(0, -1, 1), new THREE.Vector3(-1, -1, 1)],
            },
            {
                vertex: vertices.pmm,
                neighbourVoxels: [new THREE.Vector3(1, -1, 0), new THREE.Vector3(0, -1, -1), new THREE.Vector3(1, -1, -1)],
            },
            {
                vertex: vertices.pmp,
                neighbourVoxels: [new THREE.Vector3(1, -1, 0), new THREE.Vector3(0, -1, 1), new THREE.Vector3(1, -1, 1)],
            },
        ],
        normal: normals.down,
    },
    left: {
        type: "left",
        vertices: [
            {
                vertex: vertices.mmm,
                neighbourVoxels: [new THREE.Vector3(-1, -1, 0), new THREE.Vector3(-1, 0, -1), new THREE.Vector3(-1, -1, -1)],
            },
            {
                vertex: vertices.mpm,
                neighbourVoxels: [new THREE.Vector3(-1, 1, 0), new THREE.Vector3(-1, 0, -1), new THREE.Vector3(-1, 1, -1)],
            },
            {
                vertex: vertices.mmp,
                neighbourVoxels: [new THREE.Vector3(-1, -1, 0), new THREE.Vector3(-1, 0, 1), new THREE.Vector3(-1, -1, 1)],
            },
            {
                vertex: vertices.mpp,
                neighbourVoxels: [new THREE.Vector3(-1, 1, 0), new THREE.Vector3(-1, 0, 1), new THREE.Vector3(-1, 1, 1)],
            },
        ],
        normal: normals.left,
    },
    right: {
        type: "right",
        vertices: [
            {
                vertex: vertices.pmp,
                neighbourVoxels: [new THREE.Vector3(1, -1, 0), new THREE.Vector3(1, 0, 1), new THREE.Vector3(1, -1, 1)],
            },
            {
                vertex: vertices.ppp,
                neighbourVoxels: [new THREE.Vector3(1, 1, 0), new THREE.Vector3(1, 0, 1), new THREE.Vector3(1, 1, 1)],
            },
            {
                vertex: vertices.pmm,
                neighbourVoxels: [new THREE.Vector3(1, -1, 0), new THREE.Vector3(1, 0, -1), new THREE.Vector3(1, -1, -1)],
            },
            {
                vertex: vertices.ppm,
                neighbourVoxels: [new THREE.Vector3(1, 1, 0), new THREE.Vector3(1, 0, -1), new THREE.Vector3(1, 1, -1)],
            },
        ],
        normal: normals.right,
    },
    front: {
        type: "front",
        vertices: [
            {
                vertex: vertices.mmp,
                neighbourVoxels: [new THREE.Vector3(-1, 0, 1), new THREE.Vector3(0, -1, 1), new THREE.Vector3(-1, -1, 1)],
            },
            {
                vertex: vertices.mpp,
                neighbourVoxels: [new THREE.Vector3(-1, 0, 1), new THREE.Vector3(0, 1, 1), new THREE.Vector3(-1, 1, 1)],
            },
            {
                vertex: vertices.pmp,
                neighbourVoxels: [new THREE.Vector3(1, 0, 1), new THREE.Vector3(0, -1, 1), new THREE.Vector3(1, -1, 1)],
            },
            {
                vertex: vertices.ppp,
                neighbourVoxels: [new THREE.Vector3(1, 0, 1), new THREE.Vector3(0, 1, 1), new THREE.Vector3(1, 1, 1)],
            },
        ],
        normal: normals.front,
    },
    back: {
        type: "back",
        vertices: [
            {
                vertex: vertices.pmm,
                neighbourVoxels: [new THREE.Vector3(1, 0, -1), new THREE.Vector3(0, -1, -1), new THREE.Vector3(1, -1, -1)],
            },
            {
                vertex: vertices.ppm,
                neighbourVoxels: [new THREE.Vector3(1, 0, -1), new THREE.Vector3(0, 1, -1), new THREE.Vector3(1, 1, -1)],
            },
            {
                vertex: vertices.mmm,
                neighbourVoxels: [new THREE.Vector3(-1, 0, -1), new THREE.Vector3(0, -1, -1), new THREE.Vector3(-1, -1, -1)],
            },
            {
                vertex: vertices.mpm,
                neighbourVoxels: [new THREE.Vector3(-1, 0, -1), new THREE.Vector3(0, 1, -1), new THREE.Vector3(-1, 1, -1)],
            },
        ],
        normal: normals.back,
    },
};

export { faceIndices, faces, type FaceVertex, normalsById };

