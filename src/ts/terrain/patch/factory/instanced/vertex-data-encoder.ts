import { PackedUintFactory } from "../uint-packing";

class VertexDataEncoder {
    public readonly bitsPerVertex = 8;

    private readonly packedUintFactory = new PackedUintFactory(this.bitsPerVertex);
    public readonly localX = this.packedUintFactory.encodePart(2);
    public readonly localY = this.packedUintFactory.encodePart(2);
    public readonly localZ = this.packedUintFactory.encodePart(2);
    public readonly ao = this.packedUintFactory.encodePart(4);
    public readonly edgeRoundness = this.packedUintFactory.encodePart(4);

    public encode(localX: number, localY: number, localZ: number, ao: number, edgeRoundness: [boolean, boolean]): number {
        return this.localX.encode(localX) + this.localY.encode(localY) + this.localZ.encode(localZ)
            + this.ao.encode(ao)
            + this.edgeRoundness.encode(+edgeRoundness[0] + (+edgeRoundness[1] << 1));
    }
}

export {
    VertexDataEncoder
};

