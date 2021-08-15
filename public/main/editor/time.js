export class TimeSelector {
    constructor(namePrefix, config, autoValidate = false) {
        this.config = config;
        this.yearInput = document.getElementById(`${namePrefix}-year`);
        this.dayInput = document.getElementById(`${namePrefix}-day`);
        this.hourInput = document.getElementById(`${namePrefix}-hour`);
        this.selector = document.getElementById(`${namePrefix}-time`);
        if (autoValidate) {
            this.selector.onchange = () => this.validate();
        }
    }
    get date() {
        const { hoursPerDay, daysPerYear } = this.config.time;
        const timeElapsed = this.validate();
        const days = timeElapsed.year * daysPerYear + timeElapsed.day;
        const hours = days * hoursPerDay + timeElapsed.hour;
        const date = hours * 3600;
        return date;
    }
    change(action) {
        this.selector.onchange = () => action();
    }
    validate() {
        const { hoursPerDay, daysPerYear } = this.config.time;
        let year = parseInt(this.yearInput.value);
        let day = parseInt(this.dayInput.value);
        let hour = parseInt(this.hourInput.value);
        if (isNaN(year) || isNaN(day) || isNaN(hour)) {
            this.yearInput.value = "1";
            this.dayInput.value = "1";
            this.hourInput.value = "0";
            return { year: 0, day: 0, hour: 0 };
        }
        year -= 1;
        day -= 1;
        const hpd = Math.round(hoursPerDay);
        const dpy = Math.round(daysPerYear);
        if (hour >= 0) {
            day += Math.floor(hour / hpd);
        }
        else if (day > 0) {
            day -= Math.floor((hpd - hour) / hpd);
            hour = hpd - ((-hour) % hpd);
        }
        hour %= hpd;
        if (day >= 0) {
            year += Math.floor(day / dpy);
        }
        else if (year > 0) {
            year -= Math.floor((dpy - day) / dpy);
            day = dpy - ((-day) % dpy);
        }
        day %= dpy;
        year = Math.max(0, year);
        day = Math.max(0, day);
        hour = Math.max(0, hour);
        const timeElapsed = { year: year, day: day, hour: hour };
        year += 1;
        day += 1;
        this.yearInput.value = year.toString();
        this.dayInput.value = day.toString();
        this.hourInput.value = hour.toString();
        return timeElapsed;
    }
}
