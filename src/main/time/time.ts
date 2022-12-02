import { RealKSPTime } from "./realtime.js";
import { BaseKSPTime } from "./basetime.js";

export function KSPTime(date: number | DateYDHMS, config: BaseTimeSettings | RealTimeSettings): IKSPTime {
    switch(config.type) {
    case "base":
        if(config.daysPerYear === undefined || config.hoursPerDay === undefined)
            throw new Error("Missing daysPerYear or hoursPerDay in time config");
        return new BaseKSPTime(date, config);
    case "real":
        return new RealKSPTime(date, config);
    }
}