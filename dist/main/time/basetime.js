import { stringYDHMS } from "./time.js";
export class BaseKSPTime {
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
    set elapsedYDHMS(dateYDHMS) {
        let { years, days, hours, minutes, seconds } = dateYDHMS;
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
    get defaultDate() {
        return 0;
    }
}
