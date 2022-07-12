import { SolarSystem } from "../objects/system.js";
import { CameraController } from "../objects/camera.js";
import { FlybySequenceGenerator } from "../solvers/sequence-solver.js";
import { TimeSelector } from "./time-selector.js";
import { ErrorMessage } from "./error-msg.js";
import { IntegerInput } from "./integer-input.js";
import { TrajectorySolver } from "../solvers/trajectory-solver.js";
import { BodySelector } from "./body-selector.js";
import { EvolutionPlot } from "./plot.js";
import { ProgressMessage } from "./progress-msg.js";
import { SequenceSelector } from "./sequence-selector.js";
import { SubmitButton, StopButton } from "./buttons.js";
import { FlybySequence } from "../solvers/sequence.js";
import { Trajectory } from "../solvers/trajectory.js";
import { Selector } from "./selector.js";
import { DiscreteRange } from "./range.js";
import { OrbitingBody } from "../objects/body.js";

export function initEditor(controls: CameraController, system: SolarSystem, config: Config, canvas: HTMLCanvasElement){
    const systemTime = new TimeSelector("system", config);
    const updateSystemTime = () => {
        systemTime.validate();
        system.date = systemTime.dateSeconds;
        controls.centerOnTarget();
    };
    systemTime.input(updateSystemTime);
    updateSystemTime();

    // SOI toggle
    const soiCheckbox = document.getElementById("soi-checkbox") as HTMLInputElement;
    soiCheckbox.onchange = () => system.showSOIs = soiCheckbox.checked;
    soiCheckbox.checked = false; // default
    
    // Sequence generation panel
    const sequenceSelector = new SequenceSelector("sequence-selector");
    sequenceSelector.disable();

    // Origin and destination body selectors
    const originSelector = new BodySelector("origin-selector", system);
    originSelector.select(config.editor.defaultOrigin);
    const destSelector = new BodySelector("destination-selector", system);
    destSelector.select(config.editor.defaultDest);
    
    {
        // Sequence generation parameters
        const maxSwingBys    = new IntegerInput("max-swingbys");
        const maxResonant    = new IntegerInput("max-resonant-swingbys");
        const maxBackLegs    = new IntegerInput("max-back-legs");
        const maxBackSpacing = new IntegerInput("max-back-spacing");

        const assertSequenceInputs = () => {
            maxBackSpacing.assertValidity();
            maxSwingBys.assertValidity();
            maxResonant.assertValidity();
            maxBackLegs.assertValidity();
            
            if(originSelector.body.attractor.id != destSelector.body.attractor.id)
                throw new Error("Origin and destination bodies must orbit the same body.");
            
            if(originSelector.body.id == destSelector.body.id)
                throw new Error("Same origin and destination bodies.");
        }

        // Sequence generator
        const generator = new FlybySequenceGenerator(system, config);

        const progressMsg = new ProgressMessage("sequence-progress");
        const paramsErr = new ErrorMessage("sequence-params-error");

        const runSequenceGeneration = async () => {
            // Generate sequences
            const onProgress = () => {
                const percent = Math.floor(100 * generator.progression / generator.totalFeasible);
                progressMsg.setMessage(`Evaluation sequences : ${percent}%`);
            };

            const params = {
                departureId:    originSelector.body.id,
                destinationId:  destSelector.body.id,
                maxBackSpacing: maxBackSpacing.value,
                maxSwingBys:    maxSwingBys.value,
                maxResonant:    maxResonant.value,
                maxBackLegs:    maxBackLegs.value,
            };

            const sequences = await generator.generateFlybySequences(params, onProgress);
            sequenceSelector.fillFrom(sequences);
        }

        const generateSequences = async () => {
            paramsErr.hide();
            try {
                sequenceSelector.disable();
                sequenceSelector.clear();
                progressMsg.enable(1000);
                
                assertSequenceInputs();

                await runSequenceGeneration();

                sequenceSelector.enable();

            } catch(err) {
                if(err instanceof Error && err.message != "WORKER CANCELLED") 
                    paramsErr.show(err);
                console.error(err);
                
            } finally {
                progressMsg.hide();
            }
        }

        // Sequence generator buttons
        new SubmitButton("sequence-btn").click(() => generateSequences());
        new StopButton("sequence-stop-btn").click(() => generator.cancel());
    }
    
    {   
        // Time inputs
        const timeRangeStart = new TimeSelector("start", config, true);
        const timeRangeEnd   = new TimeSelector("end", config, true);

        // Numerical inputs
        const depAltitude = new IntegerInput("start-altitude");
        const destAltitude = new IntegerInput("end-altitude");

        const updateAltitudeRange = (input: IntegerInput, body: OrbitingBody) => {
            const max = Math.floor((body.soi - body.radius) / 1000);
            input.setMinMax(0, max);
        };

        depAltitude.value = config.editor.defaultAltitude;
        destAltitude.value = config.editor.defaultAltitude;

        // Custom sequence input
        const customSequence = document.getElementById("custom-sequence") as HTMLInputElement;
    
        // Trajectory solver
        const deltaVPlot = new EvolutionPlot("evolution-plot");
        deltaVPlot.hide();
    
        const solver = new TrajectorySolver(system, config, deltaVPlot);
        const paramsErr = new ErrorMessage("search-params-error");

        let trajectory: Trajectory | undefined;

        // Result panel
        const detailsSelector = new Selector("details-selector");
        const stepSlider = new DiscreteRange("displayed-steps-slider");

        detailsSelector.disable();
        stepSlider.disable();

        const getSpan = (id: string) =>  document.getElementById(id) as HTMLSpanElement;

        const resultItems = {
            dateSpan:         getSpan("maneuvre-date"),
            progradeDVSpan:   getSpan("prograde-delta-v"),
            normalDVSpan:     getSpan("normal-delta-v"),
            radialDVSpan:     getSpan("radial-delta-v"),
            depDateSpan:      getSpan("result-departure-date") ,
            totalDVSpan:      getSpan("result-total-delta-v"),
            maneuvreNumber:   getSpan("maneuvre-number"),

            flybyNumberSpan:  getSpan("flyby-number"),
            startDateSpan:    getSpan("flyby-start-date"),
            endDateSpan:      getSpan("flyby-end-date"),
            periAltitudeSpan: getSpan("flyby-periapsis-altitude"),
            inclinationSpan:  getSpan("flyby-inclination"),

            detailsSelector:  detailsSelector,
            stepSlider:       stepSlider,

            maneuverDiv:      document.getElementById("maneuvre-details") as HTMLDivElement,
            flybyDiv:         document.getElementById("flyby-details")    as HTMLDivElement
        };

        const resetFoundTrajectory = () => {
            deltaVPlot.reveal();
            detailsSelector.clear();
            detailsSelector.disable();
            stepSlider.disable();
            if(trajectory){
                trajectory.remove();
            }
        }

        const displayFoundTrajectory = () => {
            trajectory = new Trajectory(solver.bestSteps, system, config);
            trajectory.draw(canvas);
            trajectory.fillResultControls(resultItems, systemTime, controls);

            detailsSelector.select(0);
            detailsSelector.enable();
            stepSlider.enable();

            console.log(solver.bestDeltaV);
        };

        const findTrajectory = async () => {
            paramsErr.hide();
            try {
                let sequence: FlybySequence;
                if(customSequence.value == ""){
                    sequence = sequenceSelector.sequence;
                } else {
                    sequence = FlybySequence.fromString(customSequence.value, system);
                }

                updateAltitudeRange(depAltitude, sequence.bodies[0]);
                const seqLen = sequence.length;
                updateAltitudeRange(destAltitude, sequence.bodies[seqLen-1]);

                const startDate = timeRangeStart.dateSeconds;
                const endDate = timeRangeEnd.dateSeconds;
                if(endDate < startDate)
                    throw new Error("Departure date range end must be greater than the start date.");

                const depAltitudeVal = depAltitude.value * 1000;
                const destAltitudeVal = destAltitude.value * 1000;
                
                resetFoundTrajectory();

                const perfStart = performance.now();
                await solver.searchOptimalTrajectory(
                    sequence, startDate, endDate, depAltitudeVal, destAltitudeVal
                );
                console.log(`Search time: ${performance.now() - perfStart} ms`);
                
                displayFoundTrajectory();
    
            } catch(err) {
                if(err instanceof Error && err.message != "TRAJECTORY FINDER CANCELLED")
                    paramsErr.show(err);
                console.error(err);
            }
        };
    
        // Trajectory solver buttons
        new SubmitButton("search-btn").click(() => findTrajectory());
        new StopButton("search-stop-btn").click(() => solver.cancel());
    }
}
