export class EvolutionPlot {
    constructor(canvasId) {
        const data = {
            labels: [0, 1, 2, 3, 4, 5],
            datasets: [
                {
                    label: "Best ΔV",
                    backgroundColor: 'rgb(66, 135, 245)',
                    borderColor: 'rgb(66, 135, 245)',
                    data: [],
                },
                {
                    label: "Average ΔV",
                    backgroundColor: 'rgb(168, 102, 50)',
                    borderColor: 'rgb(168, 102, 50)',
                    data: [],
                }
            ]
        };
        const config = {
            type: "line",
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: "ΔV over optimization iterations"
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                },
                animation: {
                    duration: 0
                },
                scales: {
                    y: {
                        type: 'logarithmic'
                    }
                }
            }
        };
        this._container = document.getElementById(`${canvasId}-container`);
        this._chart = new Chart(document.getElementById(canvasId), config);
    }
    addIterationData(iteration, mean, best) {
        this._chart.data.labels.push(iteration);
        this._chart.data.datasets[0].data.push(best);
        this._chart.data.datasets[1].data.push(mean);
        this._chart.update();
    }
    clearPlot() {
        this._chart.data.labels = [];
        this._chart.data.datasets[0].data = [];
        this._chart.data.datasets[1].data = [];
    }
    reveal() {
        this._container.hidden = false;
    }
    hide() {
        this._container.hidden = true;
    }
}
