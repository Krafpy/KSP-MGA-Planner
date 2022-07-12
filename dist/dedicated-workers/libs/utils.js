"use strict";
var Utils;
(function (Utils) {
    function hasNaN(obj) {
        for (const value of Object.values(obj)) {
            if (typeof value == "object") {
                if (hasNaN(value))
                    return true;
            }
            else if (typeof value == "number") {
                if (isNaN(value))
                    return true;
            }
        }
        return false;
    }
    Utils.hasNaN = hasNaN;
    ;
})(Utils || (Utils = {}));
;
