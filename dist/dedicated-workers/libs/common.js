"use strict";
let onWorkerInitialize = () => { };
let onWorkerRun = () => { };
let onWorkerContinue = () => { };
let onWorkerStop = () => { };
let onWorkerDataPass = () => { };
function postMessageSafe(msg) {
    postMessage(msg);
}
function sendProgress(progress, data) {
    postMessageSafe({ label: "progress", progress: progress, data: data });
}
function debug(...data) {
    postMessageSafe({ label: "debug", data: data });
}
function sendResult(result) {
    postMessageSafe({ label: "complete", result: result });
}
onmessage = ({ data }) => {
    switch (data.label) {
        case "initialize":
            onWorkerInitialize(data.config);
            postMessageSafe({ label: "initialized" });
            break;
        case "run":
            onWorkerRun(data.input);
            break;
        case "continue":
            onWorkerContinue();
            break;
        case "stop":
            onWorkerStop();
            postMessageSafe({ label: "stopped" });
            break;
        case "pass":
            onWorkerDataPass(data.data);
            postMessageSafe({ label: "received" });
            break;
    }
};
