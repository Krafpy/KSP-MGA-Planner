import { stringYDHMS } from "./time.js";
export class RealKSPTime {
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
        return stringYDHMS(this, precision, display);
    }
    get dateSeconds() {
        return this._exactDate;
    }
    set dateSeconds(date) {
        this._exactDate = date;
    }
    get elapsedYDHMS() {
        const date = new Date(this._exactDate * 1000);
        return {
            years: date.getFullYear(),
            days: dayOfYear(date),
            hours: date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds()
        };
    }
    set elapsedYDHMS(dateYDHMS) {
        let { years, days, hours, minutes, seconds } = dateYDHMS;
        const date = new Date(70 + years, 0, days);
        date.setHours(hours);
        date.setMinutes(minutes);
        date.setSeconds(seconds);
        this._exactDate = date.getDate();
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
