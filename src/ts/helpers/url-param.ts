function getUrlNumber(name: string, defaultValue: number): number {
    const asString = new URL(window.location.href).searchParams.get(name);
    if (asString) {
        const asNumber = Number(asString);
        if (isNaN(asNumber)) {
            throw new Error(`Cannot read ${name}=${asString}`);
        }
        return asNumber;
    }
    return defaultValue;
}

export {
    getUrlNumber
};

