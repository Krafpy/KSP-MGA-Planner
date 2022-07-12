namespace Utils {

    /**
     * Checks whether an object contains a NaN value.
     * @param obj The object to check
     * @returns true if it contains a NaN value
     */
    export function hasNaN(obj: Object) {
        for(const value of Object.values(obj)){
            if(typeof value == "object"){
                if(hasNaN(value))
                    return true;
            } else if(typeof value == "number") {
                if(isNaN(value))
                    return true;
            }
        }
        return false;
    };
};