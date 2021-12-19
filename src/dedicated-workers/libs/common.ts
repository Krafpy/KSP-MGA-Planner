class WorkerEnvironment {
    public onWorkerInitialize(data: any) {}
    public onWorkerRun(input?: any) {}
    public onWorkerContinue(input?: any) {}
    public onWorkerStop() {}
    public onWorkerDataPass(data: any) {}
}

function postMessageSafe(msg: MessageFromWorker) {
    postMessage(msg);
}

function sendProgress(progress: number, data?: any){
    postMessageSafe({label: "progress", progress, data});
}

function debug(...data: any[]){
    postMessageSafe({label: "debug", data: data});
}

function sendResult(result: any) {
    postMessageSafe({label: "complete", result: result});
}

function initWorker(Env: typeof WorkerEnvironment){
    const env = new Env();
    onmessage = ({data}: MessageEvent<MessageToWorker>) => {
        switch(data.label) {
            case "initialize":
                env.onWorkerInitialize(data.config);
                postMessageSafe({label: "initialized"});
                break;
            case "run":
                env.onWorkerRun(data.input);
                break;
            case "continue":
                env.onWorkerContinue();
                break;
            case "stop":
                env.onWorkerStop();
                postMessageSafe({label: "stopped"});
                break;
            case "pass":
                env.onWorkerDataPass(data.data);
                postMessageSafe({label: "received"});
                break;
        }
    }
}