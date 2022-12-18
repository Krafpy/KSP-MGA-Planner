export class BaseKSPTime implements IKSPTime {
    private _exactDate: number = 0;

    constructor(date: number | DateYDHMS, public readonly config: BaseTimeSettings){
        if(typeof date == "number") {
            this.dateSeconds = date;
        } else {
            this.displayYDHMS = date;
        }
    }

    public stringYDHMS(precision: "h" | "hm" | "hms", display: "emt" | "ut"): string {
        let {year, day, hour, minute, second} = this.displayYDHMS;
        
        let hmsStr = "";
        switch(precision){
            case "hms": hmsStr = `:${(second >= 10 ? "" : "0")}${second.toFixed(0)}${hmsStr}`;
            case "hm":  hmsStr = `:${(minute >= 10 ? "" : "0")}${minute}${hmsStr}`;
        }
        hmsStr = `${(hour >= 10 ? "" : "0")}${hour}${hmsStr}`;
        if(precision == "h"){
            hmsStr += "h";
        }

        if(display == "ut"){
            return `Year ${year} - Day ${day} - ${hmsStr}`;
        } else {
            return `T+ ${year-1}y - ${day-1}d - ${hmsStr}`;
        }
    }

    public get dateSeconds(){
        return this._exactDate;
    }

    public set dateSeconds(date: number){
        this._exactDate = Math.max(date, 0);
    }

    public get displayYDHMS(): DateYDHMS {
        const t = this._exactDate;
        const years = Math.floor(t / this._secondsPerYear);
        const days = Math.floor((t % this._secondsPerYear) / this._secondsPerDay);
        const hour = Math.floor((t % this._secondsPerDay) / 3600);
        const minute = Math.floor((t % 3600) / 60);
        const second = (t % 60);
        return {year:years+1, day:days+1, hour, minute, second};
    }

    public set displayYDHMS(date: DateYDHMS) {
        let {year, day, hour, minute, second} = date;

        let t = this._secondsPerYear * (year-1);
        t += this._secondsPerDay * (day-1);
        t += 3600 * hour;
        t += 60 * minute;
        t += second;

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