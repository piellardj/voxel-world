import { THREE } from "../three-usage";

function computeGeometryStats(object: THREE.Object3D): void {
    let objectsCount = 0;
    let trianglesCount = 0;
    let verticesCount = 0;

    object.traverseVisible(function (object) {
        if ((object as THREE.Mesh).isMesh) {
            const mesh = object as THREE.Mesh;
            const geometry = (mesh as THREE.Mesh).geometry;

            const meshVerticesCount = geometry.attributes.position.count;

            let meshTrianglesCount: number;
            if (geometry.index !== null) {
                meshTrianglesCount = geometry.index.count / 3;
            } else {
                meshTrianglesCount = geometry.attributes.position.count / 3;
            }

            let instancesCount = 1;
            if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
                const instancedMesh = mesh as THREE.InstancedMesh;
                instancesCount = instancedMesh.count;
            }
            objectsCount += instancesCount;
            verticesCount += instancesCount * meshVerticesCount;
            trianglesCount += instancesCount * meshTrianglesCount;
        }
    });

    console.log(`${objectsCount.toLocaleString()} objects.`);
    console.log(`${trianglesCount.toLocaleString()} triangles.`);
    console.log(`${verticesCount.toLocaleString()} vertices.`);
}

export {
    computeGeometryStats
};

