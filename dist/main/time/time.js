import { RealKSPTime } from "./realtime.js";
import { BaseKSPTime } from "./basetime.js";
export function KSPTime(date, config) {
    switch (config.type) {
        case "base":
            if (config.daysPerYear === undefined || config.hoursPerDay === undefined)
                throw new Error("Missing daysPerYear or hoursPerDay in time config");
            return new BaseKSPTime(date, config);
        case "real":
            return new RealKSPTime(date, config);
    }
}
export function stringYDHMS(time, precision, display) {
    let { years, days, hours, minutes, seconds } = time.elapsedYDHMS;
    let hmsStr = "";
    switch (precision) {
        case "hms": hmsStr = `:${(seconds >= 10 ? "" : "0")}${seconds.toFixed(0)}${hmsStr}`;
        case "hm": hmsStr = `:${(minutes >= 10 ? "" : "0")}${minutes}${hmsStr}`;
    }
    hmsStr = `${(hours >= 10 ? "" : "0")}${hours}${hmsStr}`;
    if (precision == "h") {
        hmsStr += "h";
    }
    if (display == "ut") {
        years++;
        days++;
        return `Year ${years} - Day ${days} - ${hmsStr}`;
    }
    else {
        return `T+ ${years}y - ${days}d - ${hmsStr}`;
    }
}
