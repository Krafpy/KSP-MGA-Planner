export class TimeAndDate {
    private _exactDate: number = 0;

    constructor(date: number | ElapsedYDHMS, public readonly config: TimeSettings){
        if(typeof date == "number") {
            this.dateSeconds = date;
        } else {
            this.elapsedYDHMS = date;
        }
    }

    public stringYDHMS(precision: "h" | "hm" | "hms", display: "elapsed" | "date"){
        let {years, days, hours, minutes, seconds} = this.elapsedYDHMS;
        if(display == "date"){
            years++;
            days++;
        }

        if(precision == "h"){
            return `Year ${years} - Day ${days} - Hour ${hours}`;
        }

        let hmsStr = "";
        switch(precision){
            case "hms": hmsStr = `:${(seconds >= 10 ? "" : "0")}${seconds.toFixed(0)}${hmsStr}`;
            case "hm":  hmsStr = `:${(minutes >= 10 ? "" : "0")}${minutes}${hmsStr}`;
        }
        hmsStr = `${(hours >= 10 ? "" : "0")}${hours}${hmsStr}`;

        return `Year ${years} - Day ${days} - ${hmsStr}`;
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

    public set elapsedYDHMS(date: ElapsedYDHMS) {
        let {years, days, hours, minutes, seconds} = date;

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
}