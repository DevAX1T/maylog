// Authored by ZippyTheDoggy
const regex = (string: string, regex: RegExp) => {
    let m;
    let matches: string[] = [];
    let i = 0;
    while((m = regex.exec(string)) !== null) {
        if(m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        m.forEach((match, group) => {
            if(match == '' || match == undefined) return;
            if(group == 1) {
                matches.push(match);
            }
        });
        i++;
    }
    let max = 0;
    for(let i = 0; i < matches.length; i++) {
        let val = matches[i].replace(/[^\d]/gm, '');
        max += parseInt(val);
    }
    return max;
}

/**
 * Takes in a string (i.e. 1d2h3s) and returns the amount of milliseconds it represents
 * Returns false if any error occurs or if it's over the limit in milliseconds
 * @param  {string} value The value (e.g. 1d2h30s)
 * @param  {number=31557600000} limitMs The maximum amount of time to parse in millseconds. Default one year
 * @returns number
*/
const parse = (string: string, limitMs: number = 31557600000) => {
    try {
        let seconds = regex(string, /(\d+s)?/gm);
        let minutes = regex(string, /(?:(\d+m)(?=\d|$))?/gm);
        let hours = regex(string, /(\d+h)?/gm);
        let days = regex(string, /(\d+d)?/gm);
        let weeks = regex(string, /(\d+w)?/gm);
        let months = regex(string, /(\d+mo)?/gm);
        let years = regex(string, /(\d+y)?/gm);
    
        let ret: {[key:string]: number} = {};
        if(seconds > 0) ret["seconds"] = seconds;
        if(minutes > 0) ret["minutes"] = minutes;
        if(hours > 0) ret["hours"] = hours;
        if(days > 0) ret["days"] = days;
        if(weeks > 0) ret["weeks"] = weeks;
        if(months > 0) ret["months"] = months;
        if(years > 0) ret["years"] = years;    
    
        const timing = {
            seconds: 1000,
            minutes: 60000,
            hours: 3600000,
            days: 86400000,
            weeks: 604800000,
            months: 2629800000,
            years: 31557600000
        }
        let currentTime = 0;
        for(let key in ret) {
            if(ret[key] && ret[key] > 0) {
                currentTime += ret[key] * timing[key as keyof typeof timing];
            }
        }
        // Maximum time it'll convert is one year
        if (currentTime > limitMs) return false;
        return currentTime;
    } catch {
        return false;
    }
};

export default parse;