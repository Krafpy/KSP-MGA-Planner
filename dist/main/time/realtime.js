export class RealKSPTime {
    constructor(date, config) {
        this.config = config;
        this._exactDate = 0;
        if (typeof date == "number") {
            this.dateSeconds = date;
        }
        else {
            this.displayYDHMS = date;
        }
    }
    stringYDHMS(precision, display) {
        let year, day, hour, minute, second;
        if (display == "ut") {
            const ydhms = this.displayYDHMS;
            year = ydhms.year;
            day = ydhms.day;
            hour = ydhms.hour;
            minute = ydhms.minute;
            second = ydhms.second;
        }
        else {
            const t = this._exactDate;
            year = Math.floor(t / 31536000);
            day = Math.floor((t % 31536000) / 86400);
            hour = Math.floor((t % 86400) / 3600);
            minute = Math.floor((t % 3600) / 60);
            second = (t % 60);
        }
        let hmsStr = "";
        switch (precision) {
            case "hms": hmsStr = `:${(second >= 10 ? "" : "0")}${second.toFixed(0)}${hmsStr}`;
            case "hm": hmsStr = `:${(minute >= 10 ? "" : "0")}${minute}${hmsStr}`;
        }
        hmsStr = `${(hour >= 10 ? "" : "0")}${hour}${hmsStr}`;
        if (precision == "h") {
            hmsStr += "h";
        }
        if (display == "ut") {
            return `Year ${year} - Day ${day} - ${hmsStr}`;
        }
        else {
            return `T+ ${year}y - ${day}d - ${hmsStr}`;
        }
    }
    get dateSeconds() {
        return this._exactDate;
    }
    set dateSeconds(date) {
        this._exactDate = date;
    }
    get displayYDHMS() {
        const date = new Date(this._exactDate * 1000);
        return {
            year: date.getFullYear(),
            day: dayOfYear(date),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds()
        };
    }
    set displayYDHMS(dateYDHMS) {
        let { year, day, hour, minute, second } = dateYDHMS;
        const date = new Date(year, 0, day);
        date.setHours(hour);
        date.setMinutes(minute);
        date.setSeconds(second);
        this._exactDate = date.getTime() / 1000;
    }
    get defaultDate() {
        return this.config.initialDate;
    }
}
function dayOfYear(date) {
    const t1 = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const t2 = Date.UTC(date.getFullYear(), 0, 0);
    const diffMs = t1 - t2;
    const diffDays = diffMs / 1000 / 60 / 60 / 24;
    return diffDays;
}
