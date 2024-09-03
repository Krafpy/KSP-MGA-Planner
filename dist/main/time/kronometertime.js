export class KronometerTime {
    constructor(date, config) {
        this.config = config;
        this._exactDate = 0;
        this.utDisplayMode = "offset";
        if (typeof date == "number") {
            this.dateSeconds = date;
        }
        else {
            this.displayYDHMS = date;
        }
    }
    stringYDHMS(precision, display) {
        let year, day, hour, minute, second;
        if (display == "ut") {
            const ydhms = this.displayYDHMS;
            year = ydhms.year;
            day = ydhms.day;
            hour = ydhms.hour;
            minute = ydhms.minute;
            second = ydhms.second;
        }
        else {
            const t = this._exactDate;
            year = Math.floor(t / 31536000);
            day = Math.floor((t % 31536000) / 86400);
            hour = Math.floor((t % 86400) / 3600);
            minute = Math.floor((t % 3600) / 60);
            second = (t % 60);
        }
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
            return `Year ${year} - Day ${day} - ${hmsStr}`;
        }
        else {
            return `T+ ${year}y - ${day}d - ${hmsStr}`;
        }
    }
    toUT(from) {
        if (typeof from == "number")
            return new KronometerTime(from + this._exactDate, this.config);
        else
            return new KronometerTime(from.dateSeconds + this._exactDate, this.config);
    }
    get dateSeconds() {
        return this._exactDate;
    }
    set dateSeconds(date) {
        this._exactDate = date;
    }
    get displayYDHMS() {
        const daysInShortYear = Math.floor(this.config.orbitalPeriod / this.config.solarDayLength);
        const daysInLongYear = Math.ceil(this.config.orbitalPeriod / this.config.solarDayLength);
        const shortYear = this.config.solarDayLength * daysInShortYear;
        let chanceOfLeapDay = (this.config.orbitalPeriod / this.config.solarDayLength) % 1;
        if (daysInShortYear === daysInLongYear) {
            chanceOfLeapDay = 0;
        }
        let left = this._exactDate;
        let leap = 0;
        let year = 0;
        let day = 0;
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        while (left >= shortYear) {
            left -= shortYear;
            leap += chanceOfLeapDay;
            year++;
            while (Math.floor(leap) >= 1) {
                leap = Math.max(leap - 1, 0);
                if (left >= this.config.solarDayLength) {
                    left -= this.config.solarDayLength;
                }
                else {
                    year--;
                    day += daysInShortYear;
                }
            }
        }
        day += Math.floor(left / this.config.solarDayLength);
        left -= Math.floor(left / this.config.solarDayLength) * this.config.solarDayLength;
        if (left >= this.config.solarDayLength) {
            day++;
            left -= this.config.solarDayLength;
        }
        hours = Math.floor(left / 3600);
        left -= hours * 3600;
        minutes = Math.floor(left / 60);
        left -= minutes * 60;
        seconds = Math.floor(left);
        return {
            year: year + 1,
            day: day + 1,
            hour: hours,
            minute: minutes,
            second: seconds
        };
    }
    set displayYDHMS(dateYDHMS) {
        let { year, day, hour, minute, second } = dateYDHMS;
        const daysInShortYear = Math.floor(this.config.orbitalPeriod / this.config.solarDayLength);
        let chanceOfLeapDay = (this.config.orbitalPeriod / this.config.solarDayLength) % 1;
        let exactDate = 0;
        let days = (day - 1) + Math.floor((year - 1) * chanceOfLeapDay) + ((year - 1) * daysInShortYear);
        exactDate += days * this.config.solarDayLength;
        exactDate += hour * 3600;
        exactDate += minute * 60;
        exactDate += second;
        this._exactDate = exactDate;
    }
    get defaultDate() {
        return this.config.initialDate;
    }
}
