import { stringYDHMS } from "./time.js";

export class BaseKSPTime implements IKSPTime {
    private _exactDate: number = 0;

    constructor(date: number | ElapsedYDHMS, public readonly config: BaseTimeSettings){
        if(typeof date == "number") {
            this.dateSeconds = date;
        } else {
            this.elapsedYDHMS = date;
        }
    }

    public stringYDHMS(precision: "h" | "hm" | "hms", display: "emt" | "ut"): string {
        return stringYDHMS(this, precision, display);
    }

    public get dateSeconds(){
        return this._exactDate;
    }

    public set dateSeconds(date: number){
        this._exactDate = Math.max(date, 0);
    }

    public get elapsedYDHMS() : ElapsedYDHMS {
        const t = this._exactDate;
        const years = Math.floor(t / this._secondsPerYear);
        const days = Math.floor((t % this._secondsPerYear) / this._secondsPerDay);
        const hours = Math.floor((t % this._secondsPerDay) / 3600);
        const minutes = Math.floor((t % 3600) / 60);
        const seconds = (t % 60);
        return {years, days, hours, minutes, seconds};
    }

    public set elapsedYDHMS(dateYDHMS: ElapsedYDHMS) {
        let {years, days, hours, minutes, seconds} = dateYDHMS;

        let t = this._secondsPerYear * years;
        t += this._secondsPerDay * days;
        t += 3600 * hours;
        t += 60 * minutes;
        t += seconds;

        this._exactDate = Math.max(t, 0);
    }

    private get _secondsPerDay(){
        const {hoursPerDay} = this.config;
        return hoursPerDay * 3600;
    }

    private get _secondsPerYear(){
        const {daysPerYear} = this.config;
        return daysPerYear * this._secondsPerDay;
    }

    public get defaultDate() {
        return 0;
    }
}