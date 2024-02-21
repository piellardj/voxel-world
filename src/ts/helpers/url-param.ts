function getUrlNumber(name: string, defaultValue: number): number {
    const value = tryGetUrlNumber(name);
    if (value !== null) {
        return value;
    }
    return defaultValue;
}

function tryGetUrlNumber(name: string): number | null{
    const asString = new URL(window.location.href).searchParams.get(name);
    if (asString) {
        const asNumber = Number(asString);
        if (isNaN(asNumber)) {
            throw new Error(`Cannot read ${name}=${asString}`);
        }
        return asNumber;
    }
    return null;
}

export {
    getUrlNumber,
    tryGetUrlNumber
};

