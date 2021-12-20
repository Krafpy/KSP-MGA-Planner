"use strict";
function sendProgress(progress, data) {
    postMessageSafe({ label: "progress", progress, data });
}
function debug(...data) {
    postMessageSafe({ label: "debug", data: data });
}
function sendResult(result) {
    postMessageSafe({ label: "complete", result: result });
}
function postMessageSafe(msg) {
    postMessage(msg);
}
class WorkerEnvironment {
    onWorkerInitialize(data) { }
    onWorkerRun(input) { }
    onWorkerContinue(input) { }
    onWorkerStop() { }
    onWorkerDataPass(data) { }
}
function initWorker(Env) {
    const env = new Env();
    onmessage = ({ data }) => {
        switch (data.label) {
            case "initialize":
                env.onWorkerInitialize(data.config);
                postMessageSafe({ label: "initialized" });
                break;
            case "run":
                env.onWorkerRun(data.input);
                break;
            case "continue":
                env.onWorkerContinue();
                break;
            case "stop":
                env.onWorkerStop();
                postMessageSafe({ label: "stopped" });
                break;
            case "pass":
                env.onWorkerDataPass(data.data);
                postMessageSafe({ label: "received" });
                break;
        }
    };
}
