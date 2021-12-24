// Common file for all worker scripts. It adds useful communication function
// with the main thread to be automatically handled by the ComputeWorker class.

/**
 * Type enforced postMessage.
 * @param msg A message
 */
 function postMessageSafe(msg: MessageFromWorker) {
    postMessage(msg);
}

/**
 * Sends the progress status back to the main thread.
 * @param progress The progress
 * @param data Data to pass along
 */
function sendProgress(progress: number, data?: any){
    postMessageSafe({label: "progress", progress, data});
}

/**
 * Sends data to be shown in the console. Use it as a 
 * console.log
 * @param data Data to be debuged
 */
function debug(...data: any[]){
    postMessageSafe({label: "debug", data: data});
}

/**
 * Sends back a result object to the main thread, 
 * indicating an end of run.
 * @param result The results of the ComputeWorker to send back
 */
function sendResult(result: any) {
    postMessageSafe({label: "complete", result: result});
}

/**
 * Encapsulates the necessary functions for all ComputeWorkers to use.
 */
class WorkerEnvironment {
    /**
     * Initializes the events for the worker to listen and react to
     * @param Env The environment type, inheriting from `WorkerEnvironment`
     */
    public static init(Env: typeof WorkerEnvironment) {
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
    
    /**
     * Called on an initialize message.
     * @param data The received initalization data 
     */
    public onWorkerInitialize(data: any) {}
    
    /**
     * Called on a run message.
     * @param input The input provided for this run instance.
     */
    public onWorkerRun(input?: any)      {}
    
    /**
     * Called on a continue message.
     * @param input 
     */
    public onWorkerContinue(input?: any) {}

    /**
     * Called on a stop message.
     */
    public onWorkerStop()                {}

    /**
     * Called on a data pass message.
     * @param data The data passed to the worker
     */
    public onWorkerDataPass(data: any)   {}
}