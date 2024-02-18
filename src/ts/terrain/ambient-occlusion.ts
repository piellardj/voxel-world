function buildId(
    mmm: boolean,
    mmp: boolean,
    mpm: boolean,
    mpp: boolean,
    pmm: boolean,
    pmp: boolean,
    ppm: boolean,
    ppp: boolean,
): number {
    return +mmm
        + (+mmp << 1)
        + (+mpm << 2)
        + (+mpp << 3)
        + (+pmm << 4)
        + (+pmp << 5)
        + (+ppm << 6)
        + (+ppp << 7);
}

function computeAmbientOcclusion(
    mmm: boolean,
    mmp: boolean,
    mpm: boolean,
    mpp: boolean,
    pmm: boolean,
    pmp: boolean,
    ppm: boolean,
    ppp: boolean,
): number {
    const raw = 0 +
        // + +mmm
        // + +mmp
        + +mpm
        + +mpp
        // + +pmm
        // + +pmp
        + +ppm
        + +ppp;
    const truncated = Math.min(3, Math.max(0, raw));// - 4);
    const scaled = truncated;//Math.round(truncated * 3 / 8);
    return scaled;
}

function computeAmbientOcclusionMap(): Record<number, number> {
    const map: Record<number, number> = {};

    for (const mmm of [false, true]) {
        for (const mmp of [false, true]) {
            for (const mpm of [false, true]) {
                for (const mpp of [false, true]) {
                    for (const pmm of [false, true]) {
                        for (const pmp of [false, true]) {
                            for (const ppm of [false, true]) {
                                for (const ppp of [false, true]) {
                                    const id = buildId(mmm, mmp, mpm, mpp, pmm, pmp, ppm, ppp);
                                    map[id] = computeAmbientOcclusion(mmm, mmp, mpm, mpp, pmm, pmp, ppm, ppp);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return map;
}

const ambientOcclusionMap = computeAmbientOcclusionMap();

function getAmbientOcclusion(
    mmm: boolean,
    mmp: boolean,
    mpm: boolean,
    mpp: boolean,
    pmm: boolean,
    pmp: boolean,
    ppm: boolean,
    ppp: boolean,
): number {
    const id = buildId(mmm, mmp, mpm, mpp, pmm, pmp, ppm, ppp);
    const value = ambientOcclusionMap[id];
    if (typeof value === "undefined") {
        throw new Error();
    }
    return value;
}

export {
    getAmbientOcclusion
};

