class Debouncer {
    private handle: number | null = null;

    public constructor(private readonly callback: VoidFunction, private readonly timeout: number) {
    }

    public run(): void {
        if (this.handle) {
            window.clearTimeout(this.handle);
            this.handle = null;
        }

        this.handle = window.setTimeout(() => {
            this.callback();
            this.handle = null;
        }, this.timeout);
    }
}

export {
    Debouncer
};

