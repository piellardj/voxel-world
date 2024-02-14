import { Clock } from "./clock";

class Time {
    private static _clock: Clock | null = null;

    public static initialize(initialNow: number): void {
        if (Time._clock) {
            throw new Error();
        }
        Time._clock = new Clock(initialNow);
    }

    public static get clock(): Clock {
        if (!Time._clock) {
            throw new Error();
        }
        return Time._clock;
    }
}

export {
    Time
};

