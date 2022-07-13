"use strict";
var Utils;
(function (Utils) {
    function hasNaN(obj) {
        const stack = [obj];
        while (stack.length > 0) {
            const item = stack.pop();
            for (const value of Object.values(item)) {
                if (typeof value == "object") {
                    stack.push(value);
                }
                else if (typeof value == "number" && isNaN(value)) {
                    return true;
                }
            }
        }
        return false;
    }
    Utils.hasNaN = hasNaN;
})(Utils || (Utils = {}));
;
