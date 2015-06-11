'use strict';

/**
 * Kernel function to return the dot product for different spaces
 * @param {Array <number>} x1 - input first vector
 * @param {Array <number>} x2 - input second vector
 * @param {string} func - the kind of transformation
 * @param {number} par - parameter used in the polynomial and the radial function
 * @return {number} calculus of the dot product using the function
 * */
module.exports = function kernel(x1,x2,func,par) {
    func = (typeof func === 'undefined') ? 'lineal' : func;
    par = (typeof par === 'undefined') ? 2 : par;

    // The dot product between the p1 and p2 vectors
    var dot = function (p1, p2) {
        if (p1.length !== p2.length) {
            return undefined;
        }
        var l = p1.length;
        var prod = 0;

        for (var i = 0; i < l; i++) {
            prod += p1[i] * p2[i];
        }

        return prod;
    };

    var p = dot(x1,x2);
    if (func === 'lineal'){
        return p;
    }
    else if(func === 'polynomial') {
        return Math.pow((p + 1), par);
    }
    else if(func === 'radial') {
        var l = x1.length;
        var rest = new Array(l);
        for (var i = 0; i < l; i++) {
            rest[i] = x1[i] - x2[i];
        }
        var norm = dot(rest, rest);
        return Math.exp((norm)/(-2*par*par));
    }
    else {
        return undefined;
    }
};
