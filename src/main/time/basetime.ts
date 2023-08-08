export class BaseKSPTime implements IKSPTime {
    private _exactDate: number = 0;

    public utDisplayMode: "elapsed" | "offset" = "offset";

    constructor(date: number | DateYDHMS, public readonly config: BaseTimeSettings, dateMode: "elapsed" | "offset"){
        if(typeof date == "number") {
            this.dateSeconds = date;
        } else {
            this.displayYDHMS = date;
        }
        this.utDisplayMode = dateMode;
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
            if(this.utDisplayMode == "offset"){
                return `Year ${year} - Day ${day} - ${hmsStr}`;
            } else {
                return `T+ ${year}y - ${day}d - ${hmsStr}`;
            }
        } else {
            if(this.utDisplayMode == "offset"){
                return `T+ ${year-1}y - ${day-1}d - ${hmsStr}`;
            } else {
                return `T+ ${year}y - ${day}d - ${hmsStr}`;
            }
        }
    }

    public toUT(from: number | IKSPTime): IKSPTime {
        if(typeof from == "number")
            return new BaseKSPTime(from + this._exactDate, this.config, this.utDisplayMode);
        else
            return new BaseKSPTime(from.dateSeconds + this._exactDate, this.config, this.utDisplayMode);
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
        if(this.utDisplayMode == "offset"){
            return {year:years+1, day:days+1, hour, minute, second};
        } else {
            return {year:years, day:days, hour, minute, second};
        }
    }

    public set displayYDHMS(date: DateYDHMS) {
        let {year, day, hour, minute, second} = date;

        if(this.utDisplayMode == "offset"){
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