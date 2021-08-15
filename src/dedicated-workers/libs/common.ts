let onWorkerInitialize: (data: any) => void   = () => {};
let onWorkerRun:        (input?: any) => void = () => {};
let onWorkerContinue:   (input?: any) => void = () => {};
let onWorkerStop:       () => void            = () => {};
let onWorkerDataPass:   (data: any) => void   = () => {};

function postMessageSafe(msg: MessageFromWorker) {
    postMessage(msg);
}

function sendProgress(progress: number, data?: any){
    postMessageSafe({label: "progress", progress: progress, data: data});
}

function debug(...data: any[]){
    postMessageSafe({label: "debug", data: data});
}

function sendResult(result: any) {
    postMessageSafe({label: "complete", result: result});
}

onmessage = ({data}: MessageEvent<MessageToWorker>) => {
    switch(data.label) {
        case "initialize":
            onWorkerInitialize(data.config);
            postMessageSafe({label: "initialized"});
            break;
        case "run":
            onWorkerRun(data.input);
            break;
        case "continue":
            onWorkerContinue();
            break;
        case "stop":
            onWorkerStop();
            postMessageSafe({label: "stopped"});
            break;
        case "pass":
            onWorkerDataPass(data.data);
            postMessageSafe({label: "received"});
            break;
    }
};