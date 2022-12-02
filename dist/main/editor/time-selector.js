import { KSPTime } from "../time/time.js";
export class TimeSelector {
    constructor(namePrefix, config, autoValidate = false) {
        this.config = config;
        this.yearInput = document.getElementById(`${namePrefix}-year`);
        this.dayInput = document.getElementById(`${namePrefix}-day`);
        this.hourInput = document.getElementById(`${namePrefix}-hour`);
        this.selector = document.getElementById(`${namePrefix}-time`);
        if (autoValidate) {
            this.selector.oninput = () => this.validate();
        }
        this.time = KSPTime(0, this.config.time);
        this.validate();
    }
    get dateSeconds() {
        return this.time.dateSeconds;
    }
    input(action) {
        this.onChange = action;
        this.selector.oninput = () => this.onChange();
    }
    update() {
        const { years, days, hours } = this.time.elapsedYDHMS;
        const year = years + 1;
        const day = days + 1;
        const hour = hours;
        this.yearInput.value = year.toString();
        this.dayInput.value = day.toString();
        this.hourInput.value = hour.toString();
    }
    validate() {
        let year = parseInt(this.yearInput.value);
        let day = parseInt(this.dayInput.value);
        let hour = parseInt(this.hourInput.value);
        if (isNaN(year) || isNaN(day) || isNaN(hour)) {
            this.time.dateSeconds = this.time.defaultDate;
            const { years, days, hours } = this.time.elapsedYDHMS;
            this.yearInput.value = `${years + 1}`;
            this.dayInput.value = `${days + 1}`;
            this.hourInput.value = `${hours}`;
            return;
        }
        this.time.elapsedYDHMS = { years: year - 1, days: day - 1, hours: hour, minutes: 0, seconds: 0 };
        this.update();
    }
}
