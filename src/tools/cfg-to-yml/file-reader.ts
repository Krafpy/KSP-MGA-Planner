export async function readFilesFromInput(input: HTMLInputElement){
    if(input.files == null || input.files.length == 0) return [];

    const readers = [];
    for(const file of input.files){
        readers.push(readFileAsText(file));
    }
    
    let results: {filename: string, content: string}[] = [];
    const contents = (await Promise.all(readers)) as string[];
    for(let i = 0; i < input.files.length; i++){
        results.push({
            filename: input.files[i].name, content: contents[i]
        });
    }

    return results;
}

function readFileAsText(file: File){
    return new Promise((resolve,reject) => {
        let fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr);
        fr.readAsText(file);
    });
}