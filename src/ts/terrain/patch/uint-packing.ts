type PackedUintFragment = {
    readonly maxValue: number;
    encode(value: number): number;
    glslDecode(varname: string): string;
};

class PackedUintFactory {
    private nextAvailableBit: number = 0;

    public encodePart(nbValues: number): PackedUintFragment {
        const shift = this.nextAvailableBit;
        const bitsCount = this.computeBitsNeeeded(nbValues);
        this.nextAvailableBit += bitsCount;
        if (this.nextAvailableBit > 32) {
            throw new Error("Does not fit");
        }
        const maxValue = (1 << bitsCount) - 1;

        return {
            maxValue,
            encode: (value: number) => {
                if (value < 0 || value > maxValue) {
                    throw new Error("Out of range");
                }
                return value << shift;
            },
            glslDecode: (varname: string) => {
                return `((${varname} >> ${shift}u) & ${maxValue}u)`;
            },
        };
    }

    private computeBitsNeeeded(nbValues: number): number {
        for (let i = 1; i < 32; i++) {
            if (1 << i >= nbValues) {
                return i;
            }
        }
        throw new Error(`32 bits is not enough to store ${nbValues} values`);
    }
}

export {
    PackedUintFactory,
    type PackedUintFragment
};

