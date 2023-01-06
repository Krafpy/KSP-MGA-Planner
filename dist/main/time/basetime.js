export class BaseKSPTime {
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
        let { year, day, hour, minute, second } = this.displayYDHMS;
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
            return `T+ ${year - 1}y - ${day - 1}d - ${hmsStr}`;
        }
    }
    toUT(from) {
        if (typeof from == "number")
            return new BaseKSPTime(from + this._exactDate, this.config);
        else
            return new BaseKSPTime(from.dateSeconds + this._exactDate, this.config);
    }
    get dateSeconds() {
        return this._exactDate;
    }
    set dateSeconds(date) {
        this._exactDate = Math.max(date, 0);
    }
    get displayYDHMS() {
        const t = this._exactDate;
        const years = Math.floor(t / this._secondsPerYear);
        const days = Math.floor((t % this._secondsPerYear) / this._secondsPerDay);
        const hour = Math.floor((t % this._secondsPerDay) / 3600);
        const minute = Math.floor((t % 3600) / 60);
        const second = (t % 60);
        return { year: years + 1, day: days + 1, hour, minute, second };
    }
    set displayYDHMS(date) {
        let { year, day, hour, minute, second } = date;
        let t = this._secondsPerYear * (year - 1);
        t += this._secondsPerDay * (day - 1);
        t += 3600 * hour;
        t += 60 * minute;
        t += second;
        this._exactDate = Math.max(t, 0);
    }
    get _secondsPerDay() {
        const { hoursPerDay } = this.config;
        return hoursPerDay * 3600;
    }
    get _secondsPerYear() {
        const { daysPerYear } = this.config;
        return daysPerYear * this._secondsPerDay;
    }
    get defaultDate() {
        return 0;
    }
}
