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
import { Button } from "./buttons.js";
import { FlybySequence } from "../solvers/sequence.js";
import { Trajectory } from "../solvers/trajectory.js";
import { Selector } from "./selector.js";
import { DiscreteRange } from "./range.js";
import { loadBodiesData, loadConfig } from "../utilities/data.js";
import { trajectoryToCSVData, trajectoryToText } from "../utilities/trajectory-text.js";
import { DraggableTextbox } from "./draggable-text.js";
export async function initEditorWithSystem(systems, systemIndex) {
    const canvas = document.getElementById("three-canvas");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const config = await loadConfig(systems[systemIndex].folderName);
    const camera = new THREE.PerspectiveCamera(config.rendering.fov, width / height, config.rendering.nearPlane, config.rendering.farPlane);
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    const bodiesData = await loadBodiesData(systems[systemIndex].folderName);
    const system = new SolarSystem(bodiesData.sun, bodiesData.bodies, config);
    system.fillSceneObjects(scene, canvas);
    const controls = new CameraController(camera, canvas, system, config);
    controls.targetBody = system.sun;
    let stop = false;
    let stopLoop = () => stop = true;
    const loop = () => {
        if (!stop)
            requestAnimationFrame(loop);
        controls.update();
        system.update(controls);
        renderer.render(scene, camera);
    };
    requestAnimationFrame(loop);
    const datesAsElapsedCheckbox = document.getElementById("date-as-elapsed-checkbox");
    datesAsElapsedCheckbox.checked = config.time.ksp2DateMode || false;
    const initialDateDisplayMode = datesAsElapsedCheckbox.checked ? "elapsed" : "offset";
    const systemTime = new TimeSelector("system", config, initialDateDisplayMode);
    const updateSystemTime = () => {
        if (systemTime.validate()) {
            system.date = systemTime.dateSeconds;
            controls.centerOnTarget();
        }
    };
    systemTime.input(updateSystemTime);
    systemTime.setToDefault();
    updateSystemTime();
    const soiCheckbox = document.getElementById("soi-checkbox");
    soiCheckbox.onchange = () => system.showSOIs = soiCheckbox.checked;
    soiCheckbox.checked = false;
    const sequenceSelector = new SequenceSelector("sequence-selector");
    sequenceSelector.disable();
    const originSelector = new BodySelector("origin-selector", system);
    originSelector.select(config.editor.defaultOrigin);
    const destSelector = new BodySelector("destination-selector", system);
    destSelector.select(config.editor.defaultDest);
    const systemSelector = new Selector("system-selector");
    const optionNames = systems.map(s => s.name);
    systemSelector.fill(optionNames);
    systemSelector.select(systemIndex);
    {
        const maxSwingBys = new IntegerInput("max-swingbys");
        const maxResonant = new IntegerInput("max-resonant-swingbys");
        const maxBackLegs = new IntegerInput("max-back-legs");
        const maxBackSpacing = new IntegerInput("max-back-spacing");
        const assertSequenceInputs = () => {
            maxBackSpacing.assertValidity();
            maxSwingBys.assertValidity();
            maxResonant.assertValidity();
            maxBackLegs.assertValidity();
            const depBody = originSelector.body;
            const destBody = destSelector.body;
            if (depBody.attractor.id != destBody.attractor.id)
                throw new Error("Origin and destination bodies must orbit the same body.");
            if (depBody.id == destBody.id)
                throw new Error("Same origin and destination bodies.");
        };
        const generator = new FlybySequenceGenerator(system, config);
        const progressMsg = new ProgressMessage("sequence-progress");
        const paramsErr = new ErrorMessage("sequence-params-error");
        const runSequenceGeneration = async () => {
            const onProgress = () => {
                const percent = Math.floor(100 * generator.progression / generator.totalFeasible);
                progressMsg.setMessage(`Evaluation sequences : ${percent}%`);
            };
            const params = {
                departureId: originSelector.body.id,
                destinationId: destSelector.body.id,
                maxBackSpacing: maxBackSpacing.value,
                maxSwingBys: maxSwingBys.value,
                maxResonant: maxResonant.value,
                maxBackLegs: maxBackLegs.value,
            };
            const sequences = await generator.generateFlybySequences(params, onProgress);
            sequenceSelector.fillFrom(sequences);
        };
        const generateSequences = async () => {
            paramsErr.hide();
            systemSelector.disable();
            try {
                sequenceSelector.disable();
                sequenceSelector.clear();
                progressMsg.enable(1000);
                assertSequenceInputs();
                await runSequenceGeneration();
                sequenceSelector.enable();
            }
            catch (err) {
                if (err instanceof Error && err.message != "WORKER CANCELLED")
                    paramsErr.show(err);
                console.error(err);
            }
            finally {
                progressMsg.hide();
                systemSelector.enable();
            }
        };
        const seqGenBtn = new Button("sequence-btn");
        seqGenBtn.click(async () => {
            seqGenBtn.disable();
            await generateSequences();
            seqGenBtn.enable();
        });
        const seqStopBtn = new Button("sequence-stop-btn");
        seqStopBtn.click(() => generator.cancel());
    }
    {
        const timeRangeStart = new TimeSelector("start", config, initialDateDisplayMode);
        const timeRangeEnd = new TimeSelector("end", config, initialDateDisplayMode);
        timeRangeStart.setToDefault();
        timeRangeEnd.setToDefault();
        const updateTimeSelectorsUTMode = (mode) => {
            systemTime.time.utDisplayMode = mode;
            systemTime.update();
            timeRangeStart.time.utDisplayMode = mode;
            timeRangeStart.update();
            timeRangeEnd.time.utDisplayMode = mode;
            timeRangeEnd.update();
        };
        datesAsElapsedCheckbox.onchange = () => {
            const mode = datesAsElapsedCheckbox.checked ? "elapsed" : "offset";
            updateTimeSelectorsUTMode(mode);
        };
        const depAltitude = new IntegerInput("start-altitude");
        const destAltitude = new IntegerInput("end-altitude");
        const updateAltitudeRange = (input, body) => {
            const max = Math.floor((body.soi - body.radius) / 1000);
            input.setMinMax(0, max);
        };
        depAltitude.value = config.editor.defaultAltitude;
        destAltitude.value = config.editor.defaultAltitude;
        const maxDuration = new IntegerInput("max-duration");
        maxDuration.setMinMax(1, Infinity);
        maxDuration.value = config.editor.defaultMaxDuration;
        const useMaxDuration = document.getElementById("use-max-duration");
        const updateUseMaxDuration = () => {
            maxDuration.element.disabled = !useMaxDuration.checked;
        };
        useMaxDuration.onchange = updateUseMaxDuration;
        updateUseMaxDuration();
        const noInsertionBox = document.getElementById("insertion-checkbox");
        noInsertionBox.checked = false;
        const customSequence = document.getElementById("custom-sequence");
        const deltaVPlot = new EvolutionPlot("evolution-plot");
        deltaVPlot.hide();
        const solver = new TrajectorySolver(system, config, deltaVPlot);
        const paramsErr = new ErrorMessage("search-params-error");
        let trajectory;
        const detailsSelector = new Selector("details-selector");
        const stepSlider = new DiscreteRange("displayed-steps-slider");
        const showTrajDetailsBtn = new Button("show-text-btn");
        showTrajDetailsBtn.disable();
        const downloadTrajDataBtn = new Button("download-csv-btn");
        downloadTrajDataBtn.disable();
        detailsSelector.disable();
        stepSlider.disable();
        const getSpan = (id) => document.getElementById(id);
        const getDiv = (id) => document.getElementById(id);
        const resultItems = {
            dateSpan: getSpan("maneuvre-date"),
            progradeDVSpan: getSpan("prograde-delta-v"),
            normalDVSpan: getSpan("normal-delta-v"),
            radialDVSpan: getSpan("radial-delta-v"),
            ejAngleSpan: getSpan("ejection-angle"),
            depDateSpan: getSpan("result-departure-date"),
            arrDateSpan: getSpan("result-arrival-date"),
            totalDVSpan: getSpan("result-total-delta-v"),
            maneuvreNumber: getSpan("maneuvre-number"),
            flybyNumberSpan: getSpan("flyby-number"),
            startDateSpan: getSpan("flyby-start-date"),
            endDateSpan: getSpan("flyby-end-date"),
            periAltitudeSpan: getSpan("flyby-periapsis-altitude"),
            inclinationSpan: getSpan("flyby-inclination"),
            maneuverDiv: getDiv("maneuvre-details"),
            flybyDiv: getDiv("flyby-details"),
            detailsSelector: detailsSelector,
            stepSlider: stepSlider,
        };
        const resetFoundTrajectory = () => {
            systemTime.input(updateSystemTime);
            deltaVPlot.reveal();
            detailsSelector.clear();
            detailsSelector.disable();
            stepSlider.disable();
            showTrajDetailsBtn.disable();
            downloadTrajDataBtn.disable();
            if (trajectory)
                trajectory.remove();
        };
        let trajectoryCounter = 0;
        const displayFoundTrajectory = (sequence) => {
            trajectory = new Trajectory(solver, system, config);
            trajectory.draw(canvas);
            const { depDate, arrDate } = trajectory.fillResultControls(resultItems, systemTime, controls);
            datesAsElapsedCheckbox.onchange = () => {
                const mode = datesAsElapsedCheckbox.checked ? "elapsed" : "offset";
                updateTimeSelectorsUTMode(mode);
                depDate.utDisplayMode = mode;
                arrDate.utDisplayMode = mode;
                resultItems.depDateSpan.innerHTML = depDate.stringYDHMS("hms", "ut");
                resultItems.arrDateSpan.innerHTML = arrDate.stringYDHMS("hms", "ut");
            };
            systemTime.input(() => {
                updateSystemTime();
                trajectory.updatePodPosition(systemTime);
            });
            detailsSelector.select(0);
            detailsSelector.enable();
            stepSlider.enable();
            trajectory.updatePodPosition(systemTime);
            console.log(solver.bestDeltaV);
            const currentDateDisplayMode = datesAsElapsedCheckbox.checked ? "elapsed" : "offset";
            const trajText = trajectoryToText(trajectory, sequence, currentDateDisplayMode);
            console.log(trajText);
            trajectoryCounter++;
            showTrajDetailsBtn.click(() => {
                DraggableTextbox.create(`Trajectory ${trajectoryCounter}`, trajText);
            });
            showTrajDetailsBtn.enable();
            const trajCSV = trajectoryToCSVData(trajectory, currentDateDisplayMode);
            downloadTrajDataBtn.click(() => {
                let element = document.createElement('a');
                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(trajCSV));
                element.setAttribute('download', `trajectory-${trajectoryCounter}.csv`);
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
            });
            downloadTrajDataBtn.enable();
        };
        const findTrajectory = async () => {
            paramsErr.hide();
            systemSelector.disable();
            try {
                let sequence;
                if (customSequence.value != "") {
                    sequence = FlybySequence.fromString(customSequence.value, system);
                    console.debug(sequence.seqStringFullNames);
                }
                else {
                    sequence = sequenceSelector.sequence;
                }
                updateAltitudeRange(depAltitude, sequence.bodies[0]);
                const slen = sequence.length;
                updateAltitudeRange(destAltitude, sequence.bodies[slen - 1]);
                if (!timeRangeStart.validate() || !timeRangeEnd.validate()) {
                    throw new Error("Invalid departure and arrival date values.");
                }
                const startDate = timeRangeStart.dateSeconds;
                const endDate = timeRangeEnd.dateSeconds;
                if (endDate < startDate)
                    throw new Error("Departure date range end must be greater than the start date.");
                const depAltitudeVal = depAltitude.value * 1000;
                const destAltitudeVal = destAltitude.value * 1000;
                if (!maxDuration.validate()) {
                    throw new Error("Invalid duration limit.");
                }
                let maxDurationSeconds = Infinity;
                if (useMaxDuration.checked) {
                    if (config.time.type == "base") {
                        const { hoursPerDay } = config.time;
                        const secondsPerDay = hoursPerDay * 3600;
                        maxDurationSeconds = maxDuration.value * secondsPerDay;
                    }
                    else {
                        maxDurationSeconds = maxDuration.value * 24 * 3600;
                    }
                }
                console.debug(maxDurationSeconds);
                resetFoundTrajectory();
                const userSettings = {
                    startDate: startDate,
                    endDate: endDate,
                    depAltitude: depAltitudeVal,
                    destAltitude: destAltitudeVal,
                    noInsertion: noInsertionBox.checked,
                    maxDuration: maxDurationSeconds
                };
                const perfStart = performance.now();
                await solver.searchOptimalTrajectory(sequence, userSettings);
                console.log(`Search time: ${performance.now() - perfStart} ms`);
                displayFoundTrajectory(sequence);
            }
            catch (err) {
                if (err instanceof Error && err.message != "TRAJECTORY FINDER CANCELLED")
                    paramsErr.show(err);
                console.error(err);
            }
            finally {
                systemSelector.enable();
            }
        };
        const searchStartBtn = new Button("search-btn");
        searchStartBtn.click(async () => {
            searchStartBtn.disable();
            await findTrajectory();
            searchStartBtn.enable();
        });
        const searchStopBtn = new Button("search-stop-btn");
        searchStopBtn.click(() => solver.cancel());
        systemSelector.change((_, index) => {
            stopLoop();
            deltaVPlot.destroy();
            detailsSelector.clear();
            originSelector.clear();
            destSelector.clear();
            sequenceSelector.clear();
            resultItems.maneuvreNumber.innerHTML = "--";
            resultItems.endDateSpan.innerHTML = "--";
            resultItems.startDateSpan.innerHTML = "--";
            resultItems.dateSpan.innerHTML = "--";
            resultItems.progradeDVSpan.innerHTML = "--";
            resultItems.normalDVSpan.innerHTML = "--";
            resultItems.radialDVSpan.innerHTML = "--";
            resultItems.ejAngleSpan.innerHTML = "--";
            resultItems.depDateSpan.innerHTML = "--";
            resultItems.arrDateSpan.innerHTML = "--";
            resultItems.totalDVSpan.innerHTML = "--";
            resultItems.periAltitudeSpan.innerHTML = "--";
            resultItems.inclinationSpan.innerHTML = "--";
            resultItems.endDateSpan.onclick = null;
            resultItems.startDateSpan.onclick = null;
            resultItems.dateSpan.onclick = null;
            resultItems.depDateSpan.onclick = null;
            resultItems.arrDateSpan.onclick = null;
            for (let i = scene.children.length - 1; i >= 0; i--) {
                scene.remove(scene.children[i]);
            }
            camera.remove();
            scene.remove();
            renderer.dispose();
            controls.dispose();
            datesAsElapsedCheckbox.onchange = null;
            initEditorWithSystem(systems, index);
        });
    }
}
