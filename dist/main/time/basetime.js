export class BaseKSPTime {
    constructor(date, config, dateMode) {
        this.config = config;
        this._exactDate = 0;
        this.utDisplayMode = "offset";
        if (typeof date == "number") {
            this.dateSeconds = date;
        }
        else {
            this.displayYDHMS = date;
        }
        this.utDisplayMode = dateMode;
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
            if (this.utDisplayMode == "offset") {
                return `Year ${year} - Day ${day} - ${hmsStr}`;
            }
            else {
                return `T+ ${year}y - ${day}d - ${hmsStr}`;
            }
        }
        else {
            if (this.utDisplayMode == "offset") {
                return `T+ ${year - 1}y - ${day - 1}d - ${hmsStr}`;
            }
            else {
                return `T+ ${year}y - ${day}d - ${hmsStr}`;
            }
        }
    }
    toUT(from) {
        if (typeof from == "number")
            return new BaseKSPTime(from + this._exactDate, this.config, this.utDisplayMode);
        else
            return new BaseKSPTime(from.dateSeconds + this._exactDate, this.config, this.utDisplayMode);
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
        if (this.utDisplayMode == "offset") {
            return { year: years + 1, day: days + 1, hour, minute, second };
        }
        else {
            return { year: years, day: days, hour, minute, second };
        }
    }
    set displayYDHMS(date) {
        let { year, day, hour, minute, second } = date;
        if (this.utDisplayMode == "offset") {
            year -= 1;
            day -= 1;
        }
        let t = this._secondsPerYear * year;
        t += this._secondsPerDay * day;
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
