import { stringYDHMS } from "./time.js";

export class RealKSPTime implements IKSPTime {
    private _exactDate: number = 0; // time elapsed since Jan 1st 1970 (positive or negative), in seconds

    constructor(date: number | ElapsedYDHMS, public readonly config: RealTimeSettings){
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
        this._exactDate = date;
    }

    public get elapsedYDHMS() : ElapsedYDHMS {
        const date = new Date(this._exactDate * 1000);
        return {
            years:   date.getFullYear(),
            days:    dayOfYear(date),
            hours:   date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds()
        };
    }

    public set elapsedYDHMS(dateYDHMS: ElapsedYDHMS) {
        let {years, days, hours, minutes, seconds} = dateYDHMS;
        const date = new Date(70 + years, 0, days);
        date.setHours(hours);
        date.setMinutes(minutes);
        date.setSeconds(seconds);

        this._exactDate = date.getDate();
    }

    public get defaultDate(){
        return this.config.initialDate;
    }
}

function dayOfYear(date: Date) {
    const t1 = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const t2 = Date.UTC(date.getFullYear(), 0, 0);
    const diffMs = t1 - t2;
    const diffDays = diffMs / 1000 / 60 / 60 / 24;
    return diffDays;
  }