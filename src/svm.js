'use strict';
const Kernel = require('ml-kernel');

var defaultOptions = {
    C: 1,
    tol: 1e-4,
    maxPasses: 10,
    maxIterations: 10000,
    kernel: 'linear',
    alphaTol: 1e-6,
    random: Math.random
};

/**
 * Simplified version of the Sequential Minimal Optimization algorithm for training
 * support vector machines
 * @param {{Object}} options - SVM options
 * @param {Number} [options.C=1] - regularization parameter
 * @param {Number} [options.tol=1e-4] - numerical tolerance
 * @param {Number} [options.alphaTol=1e-6] - alpha tolerance, threshold to decide support vectors
 * @param {Number} [options.maxPasses=10] - max number of times to iterate over alphas without changing
 * @param {Number} [options.maxIterations=10000] - max number of iterations
 * @param {String} [options.kernel=linear] - the kind of kernel. {@link https://github.com/mljs/kernel/tree/1252de5f9012776e6e0eb06c7b434b8631fb21f0 List of kernels}
 * @param {Function} [options.random=Math.random] - custom random number generator
 * @constructor
 */
function SVM(options) {
    this.options = Object.assign({}, defaultOptions, options);

    this.kernel = new Kernel(this.options.kernel, this.options.kernelOptions);
    this.b = 0;
}

/**
 * Train the SVM model
 * @param {Array <Array <number>>} features - training data features
 * @param {Array <number>} labels - training data labels in the domain {1,-1}
 */
SVM.prototype.train = function (features, labels) {
    this._trained = false;
    this._loaded = false;
    this.N = labels.length;
    this.D = features[0].length;
    this.X = features;
    this.Y = labels;
    this.b = 0;
    this.W = undefined;

    var kernel = this.kernel.compute(features);
    var m = labels.length;
    var alpha = new Array(m).fill(0);
    this.alphas = alpha;
    for (var a = 0; a < m; a++)
        alpha[a] = 0;
    if (features.length !== m)
        throw new TypeError('Arrays should have the same length');
    var b1 = 0,
        b2 = 0,
        iter = 0,
        passes = 0,
        Ei = 0,
        Ej = 0,
        ai = 0,
        aj = 0,
        L = 0,
        H = 0,
        eta = 0;

    while (passes < this.options.maxPasses && iter < this.options.maxIterations) {
        var numChange = 0;
        for (var i = 0; i < m; i++) {
            Ei = this.marginOne(features[i]) - labels[i];
            if (labels[i]*Ei < -this.options.tol && alpha[i] < this.options.C || labels[i]*Ei > this.options.tol && alpha[i] > 0) {
                var j = i;
                while(j===i) j=Math.floor(this.options.random()*m);
                Ej = this.marginOne(features[j]) - labels[j];
                ai = alpha[i];
                aj = alpha[j];
                if (labels[i] === labels[j]) {
                    L = Math.max(0, ai+aj-this.options.C);
                    H = Math.min(this.options.C, ai+aj);
                }
                else  {
                    L = Math.max(0, aj-ai);
                    H = Math.min(this.options.C, this.options.C+aj+ai);
                }
                if(Math.abs(L - H) < 1e-4) continue;

                eta = 2*kernel[i][j] - kernel[i][i] - kernel[j][j];
                if(eta >=0) continue;
                var newaj = alpha[j] - labels[j] * (Ei - Ej) / eta;
                if (newaj > H)
                    newaj = H;
                else if (newaj < L)
                    newaj = L;
                if(Math.abs(aj - newaj) < 10e-4) continue;
                alpha[j] = newaj;
                alpha[i] = alpha[i] + labels[i]*labels[j]*(aj - newaj);
                b1 = this.b - Ei - labels[i]*(alpha[i] - ai)*kernel[i][i] - labels[j]*(alpha[j] - aj)*kernel[i][i];
                b2 = this.b - Ej - labels[i]*(alpha[i] - ai)*kernel[i][j] - labels[j]*(alpha[j] - aj)*kernel[j][j];
                this.b = (b1 + b2) / 2;
                if (alpha[i] < this.options.C && alpha[i] > 0) this.b = b1;
                if (alpha[j] < this.options.C && alpha[j] > 0) this.b = b2;
                numChange += 1;
            }
        }
        iter++;
        if (numChange == 0)
            passes += 1;
        else
            passes = 0;
    }
    if(iter === this.options.maxIterations) {
        console.warn('max iterations reached');
    }

    // Compute the weights (useful for fast decision on new test instances when linear SVM)
    if(this.options.kernel === 'linear') {
        this.W = new Array(this.D);
        for (var r = 0; r < this.D; r++) {
            this.W[r] = 0;
            for (var w = 0; w < m; w++)
                this.W[r] += labels[w]*alpha[w]*features[w][r];
        }
    }

    // Keep only support vectors
    // It will compute decision on new test instances faster
    // We also keep the index of the support vectors
    // in the original data
    var nX = [];
    var nY = [];
    var nAlphas = [];
    this._supportVectorIdx = [];
    for(i=0; i<this.N; i++) {
        if(this.alphas[i] > this.options.alphaTol) {
            nX.push(features[i]);
            nY.push(labels[i]);
            nAlphas.push(this.alphas[i]);
            this._supportVectorIdx.push(i);

        }
    }
    this.X = nX;
    this.Y = nY;
    this.N = nX.length;
    this.alphas = nAlphas;


    // A flag to say this SVM has been trained
    this._trained = true;
};

/**
 * Get prediction ({-1,1}) given one observation's features.
 * @private
 * @param p The observation's features.
 * @returns {number} Classification result ({-1,1})
 */
SVM.prototype.predictOne = function(p) {
    var margin = this.marginOne(p);
    return margin > 0 ? 1 : -1;
};

/**
 * Predict the classification outcome of a trained svm given one or several observations' features.
 * @param {Array} features - The observation(s)' features
 * @returns {Array<Number>|Number} An array of {-1, 1} if several observations are given or a number if one observation
 * is given
 */
SVM.prototype.predict = function (features) {
    if(!this._trained && !this._loaded) throw new Error('Cannot predict, you need to train the SVM first');
    if(Array.isArray(features) && Array.isArray(features[0])) {
        return features.map(this.predictOne.bind(this));
    } else {
        return this.predictOne(features);
    }
};

/**
 * Get margin given one observation's features
 * @private
 * @param {Array<Number>} features - Features
 * @returns {Number} - The computed margin
 */
SVM.prototype.marginOne = function(features) {
    var ans = this.b, i;
    if(this.options.kernel === 'linear' && this.W) {
        // Use weights, it's faster
        for(i=0; i<this.W.length; i++) {
            ans += this.W[i] * features[i];
        }
    } else {
        for(i=0; i<this.N; i++) {
            ans += this.alphas[i] * this.Y[i] * this.kernel.compute([features], [this.X[i]])[0][0];
        }
    }
    return ans;
};


/**
 * Returns the margin of one or several observations given its features
 * @param {Array <Array<Number> >|Array<Number>} features - Features from on or several observations.
 * @returns {Number|Array} The computed margin. Is an Array if several observations' features given, or a Number if
 * only one observation's features given
 */
SVM.prototype.margin = function(features) {
    if(Array.isArray(features)) {
        return features.map(this.marginOne.bind(this));
    } else {
        return this.marginOne(features);
    }
};

/**
 * Get support vectors of the trained classifier. WARINNG: this method does not work for svm instances created from
 * {@link #SVM.load load} if linear kernel
 * @returns {Array<Array<Number> >} The support vectors in feature space
 */
SVM.prototype.supportVectors = function() {
    if(!this._trained && !this._loaded) throw new Error('Cannot get support vectors, you need to train the SVM first');
    if(this._loaded && this.options.kernel === 'linear') throw new Error('Cannot get support vectors from saved linear model, you need to train the SVM to have them');
    return this.X;
};

/**
 * Create a SVM instance from a saved model
 * @param {Object} model -  Object such as returned by a trained SVM instance with {@link #SVM#toJSON toJSON}
 * @returns {SVM} Instance of svm classifier
 */
SVM.load = function (model) {
    this._loaded = true;
    this._trained = false;
    var svm = new SVM(model.options);
    if(model.options.kernel === 'linear') {
        svm.W = model.W.slice();
        svm.D = svm.W.length;
    } else {
        svm.X = model.X.slice();
        svm.Y = model.Y.slice();
        svm.alphas = model.alphas.slice();
        svm.N = svm.X.length;
        svm.D = svm.X[0].length;
    }
    svm.b = model.b;
    svm._loaded = true;
    svm._trained = false;
    return svm;
};

/**
 * Export the minimal object that enables to reload the model
 * @returns {Object} Model object that can be reused with {@link #SVM.load load}
 */
SVM.prototype.toJSON = function () {
    if(!this._trained && !this._loaded) throw new Error('Cannot export, you need to train the SVM first');
    var model = {};
    model.options = Object.assign({}, this.options);
    model.b = this.b;
    if(model.options.kernel === 'linear') {
        model.W = this.W.slice();
    } else {
        // Exporting non-linear models is heavier
        model.X = this.X.slice();
        model.Y = this.Y.slice();
        model.alphas = this.alphas.slice();
    }
    return model;
};

module.exports = SVM;