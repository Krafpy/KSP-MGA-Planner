export function parseConfigNodes(fileData) {
    fileData = fileData.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    fileData = fileData.replace(/=/g, ' = ');
    fileData = fileData.replace(/\t/g, '');
    fileData = fileData.replace(/\r/g, '\n');
    fileData = fileData.replace(/\/\/.*\n/, '\n');
    while (fileData.includes('\n\n')) {
        fileData = fileData.replace(/\n\n/g, '\n');
    }
    fileData = fileData.replace(/\n\s+/g, '\n');
    fileData = fileData.replace(/\s+\n/g, '\n');
    while (fileData.includes('  ')) {
        fileData = fileData.replace(/ {2,}/g, ' ');
    }
    if (fileData[0] === '\n') {
        fileData = fileData.slice(1);
    }
    const trigger = new Set(['\n', '}', '=']);
    const keyIgnore = new Set(['\n', ' ', '{', '}', '=']);
    const outObject = {};
    const keyRead = [0, NaN];
    let valueRead = NaN;
    const inNodes = [];
    let writeList;
    let char;
    for (let i = 0; i < fileData.length; i++) {
        char = fileData.charAt(i);
        if (trigger.has(char)) {
            if (char === '\n') {
                if ((keyRead[0] === i - 1) && keyIgnore.has(fileData[keyRead[0]])) {
                }
                else {
                    if (fileData[i + 1] === '{') {
                        inNodes.push([fileData.slice(keyRead[0], i)].join());
                        writeList = inNodes.slice();
                        writeList.push({});
                    }
                    else {
                        writeList = inNodes.slice();
                        writeList.push([fileData.slice(keyRead[0], keyRead[1] + 1)].join());
                        writeList.push(fileData.slice(valueRead, i));
                    }
                    setValue(outObject, writeList);
                }
                keyRead[0] = i + 1;
                keyRead[1] = NaN;
            }
            else if (char === '}') {
                if (inNodes.length > 0) {
                    inNodes.pop();
                }
            }
            else {
                keyRead[1] = i - 2;
                valueRead = i + 2;
            }
        }
    }
    const topKey = [...Object.keys(outObject)][0];
    return outObject[topKey].Body;
}
function setValue(obj, addressList) {
    let current = obj;
    for (let i = 0; i < addressList.length - 2; i++) {
        if (Array.isArray(current)) {
            current = current[current.length - 1][addressList[i]];
        }
        else {
            current = current[addressList[i]];
        }
    }
    if (Array.isArray(current)) {
        current = current[current.length - 1];
    }
    const key = addressList[addressList.length - 2];
    const val = addressList[addressList.length - 1];
    if (typeof val === "object") {
        if (current.hasOwnProperty(key)) {
            if (Array.isArray(current[key])) {
                current[key].push(val);
            }
            else {
                current[key] = [current[key], val];
            }
        }
        else {
            current[key] = val;
        }
    }
    else {
        if (Array.isArray(current[key])) {
            current[key].push(val);
        }
        else {
            current[key] = val;
        }
    }
}
export function parseColor(color) {
    const values = color.split(",").map(value => Math.floor(parseFloat(value) * 255));
    while (values.length > 3)
        values.pop();
    let hex = "";
    values.forEach(value => hex += value.toString(16));
    return parseInt(hex, 16);
}
