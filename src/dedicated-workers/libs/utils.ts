namespace Utils {

    /**
     * Checks whether an object contains a NaN value.
     * @param obj The object to check
     * @returns true if it contains a NaN value
     */
     export function hasNaN(obj: Object) {
        const stack: Object[] = [obj];
        while(stack.length > 0){
            const item = stack.pop() as Object;
            for(const value of Object.values(item)){
                if(typeof value == "object"){
                    stack.push(value);
                } else if(typeof value == "number" && isNaN(value)) {
                    return true;
                }
            }
        }
        return false;
    }

    /*export function hasNaN(obj: Object) {
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
    }*/
};