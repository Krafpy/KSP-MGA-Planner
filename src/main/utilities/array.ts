export function splitArrayInChunks<T>(array: T[], numChunks: number) {
    const chunks = [];
    const arrClone = array.slice();
    for (let i = numChunks; i > 0; i--) {
        chunks.push(arrClone.splice(0, Math.ceil(arrClone.length / i)));
    }
    return chunks;
}

export function mergeArrayChunks<T>(array: T[][]) {
    const flat: T[] = [];
    for(const chunk of array){
        for(const val of chunk){
            flat.push(val);
        }
    }
    return flat;
}

export function shuffleArray<T>(array: T[]){
    for(let i = array.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
}

export function joinStrings(arr: string[], sep: string){
    if(arr.length == 0)
        return "";
    let str = arr[0];
    for(let i = 1; i < arr.length; i++){
        str += sep + arr[i];
    }
    return str;
}