import { mergeArrayChunks, splitArrayInChunks } from "./array.js";

export class ComputeWorker extends Worker {
    constructor(source: string) {
        super(source);
    }
    
    public initialize(config: any){
        return new Promise<boolean>((resolve, reject) => {
            this.onerror = reject;
            this.onmessage = ({data}: MessageEvent<MessageFromWorker>) => {
                if(data.label == "initialized") resolve(true);
                else reject(`WORKER RESPONSE LABEL ERROR: "${data.label}"`);
            };
            this.postMessageSafe({label: "initialize", config: config});
        });
    }

    public run<T>(input: any, onProgress?: ProgressCallback){
        return new Promise<T>((resolve, reject) => {
            this.onerror = reject;
            this.onmessage = ({data}: MessageEvent<MessageFromWorker>) => {
                switch(data.label) {
                    case "complete":
                        this.onmessage = null;
                        resolve(data.result);
                        break;
                    case "stopped":
                        this.onmessage = null;
                        reject("WORKER CANCELLED");
                        break;
                    case "progress":
                        if(onProgress) onProgress(data.progress, data.data);
                        this.postMessageSafe({label: "continue"});
                        break;
                    case "debug":
                        console.log(...data.data);
                        break;
                    default:
                        reject(`WORKER RESPONSE LABEL ERROR: "${data.label}"`);
                        break;
                }
            };
            this.postMessageSafe({label: "run", input: input});
        });
    }

    public passData(data: any){
        return new Promise<boolean>((resolve, reject) => {
            this.onerror = reject;
            this.onmessage = ({data}: MessageEvent<MessageFromWorker>) => {
                if(data.label == "received") {
                    resolve(true);
                } else {
                    reject(`WORKER RESPONSE LABEL ERROR: "${data.label}"`);
                }
            };
            this.postMessageSafe({label: "pass", data: data});
        });
    }

    public postMessageSafe(msg: MessageToWorker){
        this.postMessage(msg);
    }
}

export class WorkerPool {
    private readonly _workers:  ComputeWorker[] = [];
    private _usedWorkers:       number = 0;
    
    public progressions:        number[] = [];

    constructor(source: string) {
        const {hardwareConcurrency} = navigator;
        const maxWorkers = hardwareConcurrency ? hardwareConcurrency : 4;
        for(let i = 0; i < maxWorkers; i++) {
            this._workers.push(new ComputeWorker(source));
        }
    }

    public get workersCount() {
        return this._workers.length;
    }

    public get usedWorkers(){
        return this._usedWorkers;
    }

    public get totalProgress(){
        let sum = 0;
        for(const progress of this.progressions) {
            sum += progress;
        }
        return sum;
    }

    public cancel() {
        for(const worker of this._workers){
            worker.postMessageSafe({label: "stop"});
        }
    }

    public terminate(){
        for(const worker of this._workers){
            worker.terminate();
        }
    }

    public initialize(config: any){
        const promises: Promise<boolean>[] = [];
        for(const worker of this._workers){
            promises.push(worker.initialize(config));
        }
        return Promise.all(promises);
    }

    public async runPool<T>(inputs: any[], onProgress?: ProgressCallback){
        if(inputs.length > this.workersCount) {
            throw new Error("More inputs than workers in the worker pool.");
        }

        this.progressions = [];
        for(let i = 0; i < inputs.length; i++) {
            this.progressions.push(0);
        }

        const promises: Promise<T>[] = [];
        for(let i = 0; i < inputs.length; i++){
            promises.push(this.runWorker<T>(i, inputs[i], onProgress));
        }
        
        return Promise.all(promises);
    }

    public async runPoolChunked<T>(inputs: any[], splitLimit: number, onProgress?: ProgressCallback) {
        this.optimizeUsedWorkersCount(inputs.length, splitLimit);
        const inputChunks = splitArrayInChunks(inputs, this._usedWorkers);
        const resultChunks = await this.runPool<T[]>(inputChunks, onProgress);
        return mergeArrayChunks(resultChunks);
    }

    public passData(data: any){
        const promises: Promise<boolean>[] = [];
        for(let i = 0; i < this._usedWorkers; i++){
            promises.push(this._workers[i].passData(data));
        }
        return Promise.all(promises);
    }

    public optimizeUsedWorkersCount(inputSize: number, splitLimit: number){
        let usedWorkers = 1;
        while(Math.floor(inputSize / usedWorkers) > splitLimit && usedWorkers < this.workersCount) {
            usedWorkers++;
        }
        this._usedWorkers = usedWorkers;
        return usedWorkers;
    }

    private runWorker<T>(id: number, input: any, onProgress?: ProgressCallback) {
        const worker = this._workers[id];
        
        const onWorkerProgress = (progress: number, data?: any) => {
            this.progressions[id] = progress;
            if(onProgress) onProgress(this.totalProgress, data);
            worker.postMessageSafe({label: "continue"});
        }

        return worker.run<T>(input, onWorkerProgress);
    }
}

export abstract class WorkerManager {
    private static _pools   = new Map<string, WorkerPool>();
    private static _workers = new Map<string, ComputeWorker>();

    public static createWorker(source: string, name: string){
        const worker = new ComputeWorker(source);
        this._workers.set(name, worker);
    }

    public static createPool(source: string, name: string){
        const pool = new WorkerPool(source);
        this._pools.set(name, pool);
    }

    public static getWorker(name: string){
        const worker = this._workers.get(name);
        if(!worker)
            throw new Error(`No worker named ${name}`);
        return worker;
    }

    public static getPool(name: string){
        const pool = this._pools.get(name);
        if(!pool)
            throw new Error(`No worker pool named ${name}`);
        return pool;
    }
}