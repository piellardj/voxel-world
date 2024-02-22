import { PackedUintFactory } from "./uint-packing";

class VertexDataEncoder {
    private readonly packedUintFactory = new PackedUintFactory();
    public readonly posX = this.packedUintFactory.encodePart(128);
    public readonly posY = this.packedUintFactory.encodePart(64);
    public readonly posZ = this.packedUintFactory.encodePart(128);
    public readonly faceId = this.packedUintFactory.encodePart(6);
    public readonly ao = this.packedUintFactory.encodePart(4);
    public readonly edgeRoundness = this.packedUintFactory.encodePart(4);
    public readonly voxelType = this.packedUintFactory.encodePart(1 << (32 - this.packedUintFactory.getNextAvailableBit()));

    public encode(posX: number, posY: number, posZ: number, faceId: number, voxelType: number, ao: number, edgeRoundness: [boolean, boolean]): number {
        return this.posX.encode(posX) + this.posY.encode(posY) + this.posZ.encode(posZ)
            + this.faceId.encode(faceId)
            + this.voxelType.encode(voxelType)
            + this.ao.encode(ao)
            + this.edgeRoundness.encode(+edgeRoundness[0] + (+edgeRoundness[1] << 1));
    }
}

export {
    VertexDataEncoder
};

