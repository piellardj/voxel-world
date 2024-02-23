import { PackedUintFactory } from "../uint-packing";

class FaceDataEncoder {
    private readonly packedUintFactory = new PackedUintFactory(32);
    public readonly voxelX = this.packedUintFactory.encodePart(128);
    public readonly voxelY = this.packedUintFactory.encodePart(64);
    public readonly voxelZ = this.packedUintFactory.encodePart(128);
    public readonly faceId = this.packedUintFactory.encodePart(6);
    public readonly voxelType = this.packedUintFactory.encodePart(1 << (32 - this.packedUintFactory.getNextAvailableBit()));

    public encode(voxelX: number, voxelY: number, voxelZ: number, faceId: number, voxelType: number): number {
        return this.voxelX.encode(voxelX) + this.voxelY.encode(voxelY) + this.voxelZ.encode(voxelZ)
            + this.faceId.encode(faceId)
            + this.voxelType.encode(voxelType);
    }
}

export {
    FaceDataEncoder,
};

