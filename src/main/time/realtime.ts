export class RealKSPTime implements IKSPTime {
    private _exactDate: number = 0; // time elapsed since Jan 1st 1970 (positive or negative), in seconds

    constructor(date: number | DateYDHMS, public readonly config: RealTimeSettings){
        if(typeof date == "number") {
            this.dateSeconds = date;
        } else {
            this.displayYDHMS = date;
        }
    }

    public stringYDHMS(precision: "h" | "hm" | "hms", display: "emt" | "ut"): string {
        let year: number, day: number, hour: number, minute: number, second: number;
        if(display == "ut"){
            const ydhms = this.displayYDHMS;
            year = ydhms.year;
            day = ydhms.day;
            hour = ydhms.hour;
            minute = ydhms.minute;
            second = ydhms.second;
        } else {
            const t = this._exactDate;
            year = Math.floor(t / 31536000);
            day = Math.floor((t % 31536000) / 86400);
            hour = Math.floor((t % 86400) / 3600);
            minute = Math.floor((t % 3600) / 60);
            second = (t % 60);
        }
        
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
            return `T+ ${year}y - ${day}d - ${hmsStr}`;
        }
    }

    public get dateSeconds(){
        return this._exactDate;
    }

    public set dateSeconds(date: number){
        this._exactDate = date;
    }

    public get displayYDHMS(): DateYDHMS {
        const date = new Date(this._exactDate * 1000);
        return {
            year:   date.getFullYear(),
            day:    dayOfYear(date),
            hour:   date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds()
        };
    }

    public set displayYDHMS(dateYDHMS: DateYDHMS){
        let {year, day, hour, minute, second} = dateYDHMS;
        let date = new Date(year, 0);
        date.setFullYear(year);
        date = new Date(date.setDate(day));
        date.setHours(hour);
        date.setMinutes(minute);
        date.setSeconds(second);
        this._exactDate = date.getTime() / 1000;
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