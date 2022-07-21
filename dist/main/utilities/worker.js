import { mergeArrayChunks, splitArrayInChunks } from "./array.js";
export class ComputeWorker extends Worker {
    constructor(source) {
        super(source);
    }
    initialize(config) {
        return new Promise((resolve, reject) => {
            this.onerror = reject;
            this.onmessage = ({ data }) => {
                if (data.label == "initialized")
                    resolve(true);
                else
                    reject(`WORKER RESPONSE LABEL ERROR: "${data.label}"`);
            };
            this.postMessageSafe({ label: "initialize", config: config });
        });
    }
    run(input, onProgress) {
        return new Promise((resolve, reject) => {
            this.onerror = reject;
            this.onmessage = ({ data }) => {
                switch (data.label) {
                    case "complete":
                        this.onmessage = null;
                        resolve(data.result);
                        break;
                    case "stopped":
                        this.onmessage = null;
                        reject("WORKER CANCELLED");
                        break;
                    case "progress":
                        if (onProgress)
                            onProgress(data.progress, data.data);
                        this.postMessageSafe({ label: "continue" });
                        break;
                    case "debug":
                        console.log(...data.data);
                        break;
                    default:
                        reject(`WORKER RESPONSE LABEL ERROR: "${data.label}"`);
                        break;
                }
            };
            this.postMessageSafe({ label: "run", input: input });
        });
    }
    passData(data) {
        return new Promise((resolve, reject) => {
            this.onerror = reject;
            this.onmessage = ({ data }) => {
                if (data.label == "received") {
                    resolve(true);
                }
                else {
                    reject(`WORKER RESPONSE LABEL ERROR: "${data.label}"`);
                }
            };
            this.postMessageSafe({ label: "pass", data: data });
        });
    }
    postMessageSafe(msg) {
        this.postMessage(msg);
    }
}
export class WorkerPool {
    constructor(source) {
        this._workers = [];
        this._usedWorkers = 0;
        this.progressions = [];
        const { hardwareConcurrency } = navigator;
        const maxWorkers = hardwareConcurrency ? hardwareConcurrency : 4;
        for (let i = 0; i < maxWorkers; i++) {
            this._workers.push(new ComputeWorker(source));
        }
    }
    get workersCount() {
        return this._workers.length;
    }
    get usedWorkers() {
        return this._usedWorkers;
    }
    get totalProgress() {
        let sum = 0;
        for (const progress of this.progressions) {
            sum += progress;
        }
        return sum;
    }
    cancel() {
        for (const worker of this._workers) {
            worker.postMessageSafe({ label: "stop" });
        }
    }
    terminate() {
        for (const worker of this._workers) {
            worker.terminate();
        }
    }
    initialize(config) {
        const promises = [];
        for (const worker of this._workers) {
            promises.push(worker.initialize(config));
        }
        return Promise.all(promises);
    }
    async runPool(inputs, onProgress) {
        if (inputs.length > this.workersCount) {
            throw new Error("More inputs than workers in the worker pool.");
        }
        this.progressions = [];
        for (let i = 0; i < inputs.length; i++) {
            this.progressions.push(0);
        }
        const promises = [];
        for (let i = 0; i < inputs.length; i++) {
            promises.push(this.runWorker(i, inputs[i], onProgress));
        }
        return Promise.all(promises);
    }
    async runPoolChunked(inputs, splitLimit, onProgress) {
        this.optimizeUsedWorkersCount(inputs.length, splitLimit);
        const inputChunks = splitArrayInChunks(inputs, this._usedWorkers);
        const resultChunks = await this.runPool(inputChunks, onProgress);
        return mergeArrayChunks(resultChunks);
    }
    passData(data) {
        const promises = [];
        for (let i = 0; i < this._usedWorkers; i++) {
            promises.push(this._workers[i].passData(data));
        }
        return Promise.all(promises);
    }
    optimizeUsedWorkersCount(inputSize, splitLimit) {
        let usedWorkers = 1;
        while (Math.floor(inputSize / usedWorkers) > splitLimit && usedWorkers < this.workersCount) {
            usedWorkers++;
        }
        this._usedWorkers = usedWorkers;
        return usedWorkers;
    }
    runWorker(id, input, onProgress) {
        const worker = this._workers[id];
        const onWorkerProgress = (progress, data) => {
            this.progressions[id] = progress;
            if (onProgress)
                onProgress(this.totalProgress, data);
            worker.postMessageSafe({ label: "continue" });
        };
        return worker.run(input, onWorkerProgress);
    }
}
export class WorkerManager {
    static createWorker(source, name) {
        const worker = new ComputeWorker(source);
        this._workers.set(name, worker);
    }
    static createPool(source, name) {
        const pool = new WorkerPool(source);
        this._pools.set(name, pool);
    }
    static getWorker(name) {
        const worker = this._workers.get(name);
        if (!worker)
            throw new Error(`No worker named ${name}`);
        return worker;
    }
    static getPool(name) {
        const pool = this._pools.get(name);
        if (!pool)
            throw new Error(`No worker pool named ${name}`);
        return pool;
    }
}
WorkerManager._pools = new Map();
WorkerManager._workers = new Map();
