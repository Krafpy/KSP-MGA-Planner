// by theAstrogoth : https://github.com/theastrogoth/Kerbal-Transfer-Illustrator/blob/main/src/main/utilities/parseConfigNodes.ts

export function parseConfigNodes(fileData: string) {
    // preprocessing
    fileData = fileData.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');   // removes all double slash '//' comments
    fileData = fileData.replace(/=/g, ' = ');                      // ensure spaces around each '='
    fileData = fileData.replace(/\t/g, '');                        // remove all tabs
    fileData = fileData.replace(/\r/g, '\n')                       // replace all return character '/r' with line break '/n'
    fileData = fileData.replace(/\/\/.*\n/, '\n')       // attempt to remove comments
    while (fileData.includes('\n\n')) {                 // ensure only single line breaks
        fileData = fileData.replace(/\n\n/g, '\n');
    }
    fileData = fileData.replace(/\n\s+/g, '\n');        // remove spaces after a new line
    fileData = fileData.replace(/\s+\n/g, '\n');        // remove spaces before a new line
    while (fileData.includes('  ')) {
        fileData = fileData.replace(/ {2,}/g, ' ');     // ensure only single spaces
    }
    if(fileData[0] === '\n') {                          // remove new line at the beginning of the file
        fileData = fileData.slice(1);
    }
    // characters that signal key/value start/end
    const trigger = new Set(['\n', '}', '=']);
    const keyIgnore = new Set(['\n', ' ', '{', '}', '=']);

    // object to be returned
    const outObject: any = {};

    // prepare arrays to store key/value indices
    const keyRead = [0, NaN];
    let valueRead: number = NaN;
    const inNodes: string[] = [];
    let writeList: any[];
    let char: string;

    // iterate through each character
    for(let i=0; i<fileData.length; i++) { //(let i=0; i<fileData.length; i++) 
        char = fileData.charAt(i);
        // check if the current character leads to an action
        if (trigger.has(char)) {
            if (char === '\n') {
                // if the key is empty, continue
                if ((keyRead[0] === i - 1) && keyIgnore.has(fileData[keyRead[0]])) {
                    // pass
                } else {
                    // if the next character is an open bracket, save it to a new node
                    if (fileData[i+1] === '{') {
                        inNodes.push([fileData.slice(keyRead[0], i)].join());
                        writeList = inNodes.slice();
                        writeList.push({})
                    // otherwise it a value in an existing node
                    } else {
                        writeList = inNodes.slice();
                        writeList.push([fileData.slice(keyRead[0], keyRead[1]+1)].join())
                        writeList.push(fileData.slice(valueRead, i))
                    }
                // set value in outObject
                setValue(outObject, writeList)
                }
                keyRead[0] = i+1;
                keyRead[1] = NaN;
            // if the character is a closed bracket, the end of a node has been reached   
            } else if (char === '}') {
                if (inNodes.length > 0) {
                    inNodes.pop()
                }
            // the last case is that the character is an =, and a key has been read
            } else {
                keyRead[1] = i - 2;
                valueRead = i + 2;
            }
        }
    }

    const topKey = [...Object.keys(outObject)][0];
    return outObject[topKey].Body; // return only the body data
}

function setValue(obj: Object, addressList: any[]) {
    let current: any = obj;
    for(let i=0; i<addressList.length - 2; i++) {
        if(Array.isArray(current)) {
            // if current is an array, we're always going to care about the last entry
            current = current[current.length - 1][addressList[i]];
        } else {
            current = current[addressList[i]]
        }
    }
    if(Array.isArray(current)) {
        current = current[current.length - 1];
    }

    const key = addressList[addressList.length - 2];
    const val = addressList[addressList.length - 1];

    if(typeof val === "object") {
        if(current.hasOwnProperty(key)) {
            if(Array.isArray(current[key])) {
                current[key].push(val);
            } else {
                current[key] = [current[key], val];
            }
        } else {
            current[key] = val;
        }
    } else {
        if(Array.isArray(current[key])) {
            current[key].push(val);
        } else {
            current[key] = val;
        }
    }
}

export function parseColor(color: string){
    const values = color.split(",").map(value => Math.floor(parseFloat(value)*255));
    while(values.length > 3) values.pop();
    let hex = "";
    values.forEach(value => hex += value.toString(16));
    return parseInt(hex, 16);
}