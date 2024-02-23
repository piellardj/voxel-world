import { THREE } from "../three-usage";

function computeGeometryStats(object: THREE.Object3D): void {
    let objectsCount = 0;
    let trianglesCount = 0;
    let verticesCount = 0;
    let totalBuffersSizeInByte = 0;

    object.traverseVisible(subObject => {
        if ((subObject as THREE.Mesh).isMesh) {
            const mesh = subObject as THREE.Mesh;
            const geometry = (mesh as THREE.Mesh).geometry;

            const meshVerticesCount = geometry.drawRange.count;

            let meshTrianglesCount: number;
            if (geometry.index !== null) {
                meshTrianglesCount = geometry.index.count / 3;
            } else {
                meshTrianglesCount = geometry.drawRange.count / 3;
            }

            for (const attribute of Object.values(mesh.geometry.attributes)) {
                totalBuffersSizeInByte += attribute.array.byteLength;
            }
            if (mesh.geometry.index) {
                totalBuffersSizeInByte += mesh.geometry.index.array.byteLength;
            }

            let meshInstancesCount = 1;
            let geometryInstancesCount = 1;
            if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
                const instancedMesh = mesh as THREE.InstancedMesh;
                meshInstancesCount = instancedMesh.count;
            }
            if ((geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry) {
                const instancedGeometry = geometry as THREE.InstancedBufferGeometry;
                geometryInstancesCount = instancedGeometry.instanceCount;
            }
            objectsCount += meshInstancesCount;
            verticesCount += meshInstancesCount * geometryInstancesCount * meshVerticesCount;
            trianglesCount += meshInstancesCount * geometryInstancesCount * meshTrianglesCount;
        }
    });

    console.log(`${objectsCount.toLocaleString()} objects.`);
    console.log(`${trianglesCount.toLocaleString()} triangles.`);
    console.log(`${verticesCount.toLocaleString()} vertices.`);
    console.log(`${(totalBuffersSizeInByte / 1024 / 1024).toLocaleString()} MB of GPU buffers in total (${totalBuffersSizeInByte} bytes)`);
}

export {
    computeGeometryStats
};

