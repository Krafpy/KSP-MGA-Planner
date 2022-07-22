export class EvolutionPlot {
    private readonly _chart!:     Chart;
    private readonly _container!: HTMLDivElement;

    private static _instance:     EvolutionPlot;

    constructor(canvasId: string){
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
            }]
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
                    point:{
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
        }

        this._container = document.getElementById(`${canvasId}-container`) as HTMLDivElement;
        this._chart = new Chart(
            document.getElementById(canvasId) as HTMLCanvasElement,
            //@ts-ignore
            config
        );
    }
    
    public addIterationData(iteration: number, mean: number, best: number){
        // @ts-ignore
        this._chart.data.labels.push(iteration);
        // @ts-ignore
        this._chart.data.datasets[0].data.push(best);
        // @ts-ignore
        this._chart.data.datasets[1].data.push(mean);

        this._chart.update();
    }

    public clearPlot(){
        this._chart.data.labels = [];
        // @ts-ignore
        this._chart.data.datasets[0].data = [];
        // @ts-ignore
        this._chart.data.datasets[1].data = [];
    }

    public destroy(){
        this._chart.destroy();
    }

    public reveal(){
        this._container.hidden = false;
    }

    public hide(){
        this._container.hidden = true;
    }
}