import { KSPTime } from "../time/time.js";
export class TimeSelector {
    constructor(namePrefix, config, dateMode) {
        this.config = config;
        this.yearInput = document.getElementById(`${namePrefix}-year`);
        this.dayInput = document.getElementById(`${namePrefix}-day`);
        this.hourInput = document.getElementById(`${namePrefix}-hour`);
        this.selector = document.getElementById(`${namePrefix}-time`);
        this.selector.oninput = () => this.validate();
        this.time = KSPTime(0, this.config.time, dateMode);
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
        const { year, day, hour } = this.time.displayYDHMS;
        this.yearInput.value = year.toString();
        this.dayInput.value = day.toString();
        this.hourInput.value = hour.toString();
    }
    validate() {
        let year = parseInt(this.yearInput.value);
        let day = parseInt(this.dayInput.value);
        let hour = parseInt(this.hourInput.value);
        if (isNaN(year) || isNaN(day) || isNaN(hour)) {
            return false;
        }
        else {
            this.time.displayYDHMS = { year, day, hour, minute: 0, second: 0 };
            this.update();
        }
        return true;
    }
    setToDefault() {
        this.time.dateSeconds = this.time.defaultDate;
        this.update();
    }
}
