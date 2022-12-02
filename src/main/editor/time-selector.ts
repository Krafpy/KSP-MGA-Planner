import { KSPTime } from "../time/time.js";

export class TimeSelector {
    readonly time!: IKSPTime;
    onChange!: () => void;

    readonly yearInput!: HTMLInputElement;
    readonly dayInput!:  HTMLInputElement;
    readonly hourInput!: HTMLInputElement;
    readonly selector!:  HTMLDivElement;
    
    constructor(namePrefix: string, public readonly config: Config, private readonly autoValidate: boolean = false) {
        this.yearInput = document.getElementById(`${namePrefix}-year`) as HTMLInputElement;
        this.dayInput  = document.getElementById(`${namePrefix}-day`)  as HTMLInputElement;
        this.hourInput = document.getElementById(`${namePrefix}-hour`) as HTMLInputElement;

        this.selector = document.getElementById(`${namePrefix}-time`) as HTMLDivElement;

        /*if(this.autoValidate) {
            this.selector.oninput = () => this.validate();
        }*/
        this.selector.oninput = () => this.validate();
        this.time = KSPTime(0, this.config.time);
        this.validate();
    }

    get dateSeconds(){
        return this.time.dateSeconds;
    }

    public input(action: () => void){
        this.onChange = action;
        this.selector.oninput = () => this.onChange();
    }

    public update(){
        const {year, day, hour} = this.time.displayYDHMS;
        this.yearInput.value = year.toString();
        this.dayInput.value  = day.toString();
        this.hourInput.value = hour.toString();
    }

    public validate(): boolean {
        let year = parseInt(this.yearInput.value);
        let day  = parseInt(this.dayInput.value);
        let hour = parseInt(this.hourInput.value);

        if(isNaN(year) || isNaN(day) || isNaN(hour)){
            if(!this.autoValidate)
                return false;
            this.setToDefault();
        } else {
            this.time.displayYDHMS = {year, day, hour, minute: 0, second: 0};
            this.update();
        }
        return true;
    }

    public setToDefault(){
        this.time.dateSeconds = this.time.defaultDate;
        this.update();
    }
}