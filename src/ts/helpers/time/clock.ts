type ScheduledCall = {
    readonly callback: VoidFunction;
    readonly time: number;
};

class Clock {
    private scheduledCalls: ScheduledCall[] = [];

    public constructor(private time: number) {
    }

    public get now(): number {
        return this.time;
    }

    public setNow(value: number): number {
        const deltaTime = value - this.time;
        this.time = value;

        const readyScheduledCalls: ScheduledCall[] = [];
        const remainingScheduledCalls: ScheduledCall[] = [];
        for (const scheduledCall of this.scheduledCalls) {
            if (scheduledCall.time < this.now) {
                readyScheduledCalls.push(scheduledCall);
            } else {
                remainingScheduledCalls.push(scheduledCall);
            }
        }
        this.scheduledCalls = remainingScheduledCalls;

        for (const readyScheduleCall of readyScheduledCalls) {
            readyScheduleCall.callback();
        }

        return deltaTime;
    }

    public setTimeout(callback: VoidFunction, delay: number): void {
        this.scheduledCalls.push({
            callback,
            time: this.now + delay,
        });
    }
}

export {
    Clock
};

