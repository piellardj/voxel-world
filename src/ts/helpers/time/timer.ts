class Timer {
    private readonly start = performance.now();

    public elapsed():number {
        return performance.now() - this.start;
    }
}

export {
    Timer
};
