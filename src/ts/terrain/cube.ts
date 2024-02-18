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

type FaceNormal = {
    readonly id: number;
    readonly normal: THREE.Vector3;
};
let iN = 0;
const normals: FaceNormal[] = [
    { id: iN++, normal: new THREE.Vector3(0, +1, 0) },
    { id: iN++, normal: new THREE.Vector3(0, -1, 0) },
    { id: iN++, normal: new THREE.Vector3(-1, 0, 0) },
    { id: iN++, normal: new THREE.Vector3(+1, 0, 0) },
    { id: iN++, normal: new THREE.Vector3(0, 0, +1) },
    { id: iN++, normal: new THREE.Vector3(0, 0, -1) },
];

type FaceType = "up" | "down" | "left" | "right" | "front" | "back";
type Face = {
    readonly type: FaceType;
    readonly vertices: [FaceVertex, FaceVertex, FaceVertex, FaceVertex];
    readonly normal: FaceNormal;
    readonly indices: [number, number, number, number, number, number];
};

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
        normal: normals[0],
        indices: [0, 2, 1, 1, 2, 3],
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
        normal: normals[1],
        indices: [0, 2, 1, 1, 2, 3],
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
        normal: normals[2],
        indices: [0, 2, 1, 1, 2, 3],
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
        normal: normals[3],
        indices: [0, 2, 1, 1, 2, 3],
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
        normal: normals[4],
        indices: [0, 2, 1, 1, 2, 3],
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
        normal: normals[5],
        indices: [0, 2, 1, 1, 2, 3],
    },
};

export {
    faces, normals, type FaceVertex
};

