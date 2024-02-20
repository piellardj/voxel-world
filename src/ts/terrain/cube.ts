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


const normals: Record<FaceType, THREE.Vector3> = {
    up: new THREE.Vector3(0, +1, 0),
    down: new THREE.Vector3(0, -1, 0),
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(+1, 0, 0),
    front: new THREE.Vector3(0, 0, +1),
    back: new THREE.Vector3(0, 0, -1),
};

type Face = {
    readonly id: number;
    readonly type: FaceType;
    readonly vertices: [FaceVertex, FaceVertex, FaceVertex, FaceVertex];
    readonly normal: THREE.Vector3;
};

const faceIndices: [number, number, number, number, number, number] = [0, 2, 1, 1, 2, 3];

let iF = 0;
const faces: Record<FaceType, Face> = {
    up: {
        id: iF++,
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
        id: iF++,
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
        id: iF++,
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
        id: iF++,
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
        id: iF++,
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
        id: iF++,
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

const facesById = Object.values(faces).sort((face1: Face, face2: Face) => face1.id - face2.id);
export { faceIndices, faces, type FaceVertex, facesById };

