import { THREE } from "../three-usage";

function computeGeometryStats(object: THREE.Object3D): void {
    let objectsCount = 0;
    let trianglesCount = 0;
    let verticesCount = 0;
    let totalBuffersSizeInByte = 0;

    object.traverseVisible(function (object) {
        if ((object as THREE.Mesh).isMesh) {
            const mesh = object as THREE.Mesh;
            const geometry = (mesh as THREE.Mesh).geometry;

            const posAttribute = geometry.attributes.position || geometry.attributes.aData;
            const meshVerticesCount = posAttribute.count;

            let meshTrianglesCount: number;
            if (geometry.index !== null) {
                meshTrianglesCount = geometry.index.count / 3;
            } else {
                meshTrianglesCount = posAttribute.count / 3;
            }

            for (const attribute of Object.values(mesh.geometry.attributes)) {
                totalBuffersSizeInByte += attribute.array.byteLength;
            }
            if (mesh.geometry.index) {
                totalBuffersSizeInByte += mesh.geometry.index.array.byteLength;
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
    console.log(`${(totalBuffersSizeInByte / 1024 / 1024).toLocaleString()} MB of buffers in total (${totalBuffersSizeInByte} bytes)`);
}

export {
    computeGeometryStats
};

