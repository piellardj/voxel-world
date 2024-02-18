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
    readonly vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
    readonly normal: FaceNormal;
    readonly indices: [number, number, number, number, number, number];
};

const faces: Record<FaceType, Face> = {
    up: {
        type: "up",
        vertices: [vertices.ppm, vertices.ppp, vertices.mpm, vertices.mpp],
        normal: normals[0],
        indices: [0, 2, 1, 1, 2, 3],
    },
    down: {
        type: "down",
        vertices: [vertices.mmm, vertices.mmp, vertices.pmm, vertices.pmp],
        normal: normals[1],
        indices: [0, 2, 1, 1, 2, 3],
    },
    left: {
        type: "left",
        vertices: [vertices.mmm, vertices.mpm, vertices.mmp, vertices.mpp],
        normal: normals[2],
        indices: [0, 2, 1, 1, 2, 3],
    },
    right: {
        type: "right",
        vertices: [vertices.pmp, vertices.ppp, vertices.pmm, vertices.ppm],
        normal: normals[3],
        indices: [0, 2, 1, 1, 2, 3],
    },
    front: {
        type: "front",
        vertices: [vertices.mmp, vertices.mpp, vertices.pmp, vertices.ppp],
        normal: normals[4],
        indices: [0, 2, 1, 1, 2, 3],
    },
    back: {
        type: "back",
        vertices: [vertices.pmm, vertices.ppm, vertices.mmm, vertices.mpm],
        normal: normals[5],
        indices: [0, 2, 1, 1, 2, 3],
    },
};

export {
    faces, normals
};

