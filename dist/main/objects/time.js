export class TimeAndDate {
    constructor(date, config) {
        this.config = config;
        this._exactDate = 0;
        if (typeof date == "number") {
            this.dateSeconds = date;
        }
        else {
            this.elapsedYDHMS = date;
        }
    }
    stringYDHMS(precision, display) {
        let { years, days, hours, minutes, seconds } = this.elapsedYDHMS;
        if (display == "date") {
            years++;
            days++;
        }
        if (precision == "h") {
            return `Year ${years} - Day ${days} - Hour ${hours}`;
        }
        let hmsStr = "";
        switch (precision) {
            case "hms": hmsStr = `:${(seconds >= 10 ? "" : "0")}${seconds.toFixed(0)}${hmsStr}`;
            case "hm": hmsStr = `:${(minutes >= 10 ? "" : "0")}${minutes}${hmsStr}`;
        }
        hmsStr = `${(hours >= 10 ? "" : "0")}${hours}${hmsStr}`;
        return `Year ${years} - Day ${days} - ${hmsStr}`;
    }
    get dateSeconds() {
        return this._exactDate;
    }
    set dateSeconds(date) {
        this._exactDate = Math.max(date, 0);
    }
    get elapsedYDHMS() {
        const t = this._exactDate;
        const years = Math.floor(t / this._secondsPerYear);
        const days = Math.floor((t % this._secondsPerYear) / this._secondsPerDay);
        const hours = Math.floor((t % this._secondsPerDay) / 3600);
        const minutes = Math.floor((t % 3600) / 60);
        const seconds = (t % 60);
        return { years, days, hours, minutes, seconds };
    }
    set elapsedYDHMS(date) {
        let { years, days, hours, minutes, seconds } = date;
        let t = this._secondsPerYear * years;
        t += this._secondsPerDay * days;
        t += 3600 * hours;
        t += 60 * minutes;
        t += seconds;
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
}
