/**
 * Headless utilities.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

/**
 * Utils constructor.
 *
 * @constructor
 */
var __Utils__ = function () {
    "use strict";
    var ctor = function () {
        this.Utils = this.constructor;
    };
    var superCtor = arguments.length ? arguments[0] : null;
    if (superCtor) inherits(ctor, superCtor);
    return ctor;
};
var Utils = __Utils__();
Utils.prototype.__Utils__ = __Utils__;

function pad(n) {
    "use strict";
    return n < 10 ? '0'+n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
    "use strict";
    var d = new Date();
    var time = [
        pad(d.getHours()),
        pad(d.getMinutes()),
        pad(d.getSeconds())
    ].join(':');
    return [d.getDate(), months[d.getMonth()], time].join(' ');
}
Utils.prototype.timestamp = timestamp;

/**
 * Clones an object.
 *
 * Abducted from CasperJS' utils.js.
 *
 * @param    {*} o
 * @returns  {*}
 */
function clone(o) {
    "use strict";
    return JSON.parse(JSON.stringify(o));
}
Utils.prototype.clone = clone;

/**
 * Inherit the prototype methods from one constructor into another.
 *
 * Abducted from CasperJS' utils.js.
 *
 * @param    {function} ctor Constructor which needs to inherit the prototype
 * @param    {function} superCtor Constructor to inherit prototype from
 */
function inherits(ctor, superCtor) {
    "use strict";
    ctor.super_ = ctor.__super__ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
}
Utils.prototype.inherits = inherits;

/**
 * Object recursive merging utility equivalent of CasperJS `utils.mergeObjects()`.
 *
 * Abducted from CasperJS' utils.js.
 *
 * @param    {Object} origin The origin object
 * @param    {Object} add The object to merge data into origin
 * @param    {Object} opts Optional options to be passed in
 * @returns  {Object}
 */
function extend(origin, add, opts) {
    "use strict";

    var options = opts || {},
        keepReferences = options.keepReferences;

    for (var p in add) {
        if (add[p] && add[p].constructor === Object) {
            if (origin[p] && origin[p].constructor === Object) {
                origin[p] = extend(origin[p], add[p]);
            } else {
                origin[p] = keepReferences ? add[p] : clone(add[p]);
            }
        } else {
            origin[p] = add[p];
        }
    }
    return origin;
}
Utils.prototype.extend = extend;

/**
 * Formats a string with passed parameters. Ported from nodejs `util.format()`.
 *
 * Abducted from CasperJS' utils.js.
 *
 * @param    {string} f
 * @returns  {string}
 */
function format(f) {
    "use strict";
    var i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(/%[sdj%]/g, function _replace(x) {
        if (i >= len) return x;
        switch (x) {
        case '%s':
            return String(args[i++]);
        case '%d':
            return Number(args[i++]);
        case '%j':
            return JSON.stringify(args[i++]);
        case '%%':
            return '%';
        default:
            return x;
        }
    });
    for (var x = args[i]; i < len; x = args[++i]) {
        if (x === null || typeof x !== 'object') {
            str += ' '+x;
        } else {
            str += '[obj]';
        }
    }
    return str;
}
Utils.prototype.format = format;

/**
 * Add slashes equivalent of PHP `addslashes()`.
 *
 * @param    {string} str
 * @returns  {string}
 */
function addslashes(str) {
    "use strict";
    return str.replace(/\\/g, '\\\\').
    replace(/\u0008/g, '\\b').
    replace(/\t/g, '\\t').
    replace(/\n/g, '\\n').
    replace(/\f/g, '\\f').
    replace(/\r/g, '\\r').
    replace(/'/g, '\\\'').
    replace(/"/g, '\\"');
}
Utils.prototype.addslashes = addslashes;

/**
 * Utils basename.
 *
 * Strip .js.
 *
 * @param    {string} str Path
 * @param    {string} [ext=.js] Extension
 * @returns  {string}
 */
function basename(str, ext) {
    "use strict";
    ext = ext || '.js';
    return str.replace(/\\/g, '/').replace(/.*\//, '').replace(new RegExp(ext+'$'), '');
}
Utils.prototype.basename = basename;

/**
 * Script constructor.
 *
 * @constructor
 */
var Script = function () {
    "use strict";
    var ctor = function () {
        this.Script = this.constructor;
    };
    var args = arguments,
        len = args.length,
        superCtor = typeof arguments[0] === 'function' ? arguments[0] : null,
        id = len > 2 ? arguments[1] : arguments[0],
        name = len > 2 ? arguments[2] : arguments[1];
    if (superCtor) inherits(ctor, superCtor);
    if (id && name) {
        ctor.prototype.id = basename(id);
        ctor.prototype.name = name;
    }
    return ctor;
};
Utils.prototype.Script = Script;

/**
 * Terms to pattern.
 *
 * Lookahead and negated lookahead.
 * Alternatives can be specified in the terms.
 *
 * @param    {string} str Space delimited list of terms
 * @returns  {string}
 */
function termsToPattern(str) {
    "use strict";
    var out = '^',
        terms = str.split(' ');
    for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (/^-/.exec(term)) {
            out += '(?!.*('+term.substring(1)+'))';
        } else {
            out += '(?=.*('+term+'))';
        }
    }
    return out;
}
Utils.prototype.termsToPattern = termsToPattern;

/**
 * Text to pattern.
 *
 * Currently only greater than or equal to ranges are supported.
 * Greater than or equal to date, YYYY-MM-DD format.
 * Greater than or equal to integer.
 *
 * @param    {string} str
 * @returns  {string}
 */
function textToPattern(str) {
    "use strict";
    var texts = str.split('.');
    for (var i = 0; i < texts.length; i++) {
        var text = texts[i];
        if (/\d{4}-\d{2}-\d{2}\+$/.test(text)) {
            var m = /(\d{4})-(\d{2})-(\d{2})/.exec(text),
                nextyear = (parseInt(m[1], 10)+1).toString(),
                nextmonth = (parseInt(m[2], 10)+1).toString();
            if (nextmonth.length < 2) {
                nextmonth = '0'+nextmonth;
            } else if (nextmonth === '13') {
                nextmonth = '01';
            }
            texts[i] = '(\
                ['+m[1][0]+'-9]['+m[1][1]+'-9]['+m[1][2]+'-9]['+m[1][3]+'-9].\
                ('+m[2][0]+m[2][1]+'.['+m[3][0]+'-3]['+m[3][1]+'-9]|['+nextmonth[0]+'-1]['+nextmonth[1]+'-9] [0-3][1-9])|\
                ['+nextyear[0]+'-9]['+nextyear[1]+'-9]['+nextyear[2]+'-9]['+nextyear[3]+'-9].\
                [0-1][1-9].[0-3][1-9]\
            )';
        } else if (/\d\+$/.test(text)) {
            var m = /(\d+)/.exec(text),
                number = m[1].replace(/(\d)/g, '[$1-9]'),
                next = ((parseInt(m[1][0], 10)+1).toString()+m[1].substring(1).replace(/(\d)/g, '0')).replace(/(\d)/g, '[$1-9]');
            texts[i] = text.replace(/(\d+\+)/g, '('+number+'|'+next+')');
        }
    }
    return texts.join('.');
}
Utils.prototype.textToPattern = textToPattern;

/**
 * File size parser.
 *
 * Convert human readable file sizes to their byte equivalent.
 *
 * Abducted from filesize-parser's index.js.
 *
 * @param    {*} input
 * @returns  {number}
 */
function filesize(input) {
    "use strict";
    var validAmount = function (n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };
    var parsableUnit = function (u) {
        return u.match(/\D*/).pop() === u;
    };
    var increments = [
        [["B"], 1],
        [["Kb"], 128],
        [["k", "K", "kb", "KB", "KiB"], 1024],
        [["Mb"], 131072],
        [["m", "M", "mb", "MB", "MiB"], 1.049e+6],
        [["Gb"], 1.342e+8],
        [["g", "G", "gb", "GB", "GiB"], 1.074e+9],
        [["Tb"], 1.374e+11],
        [["t", "T", "tb", "TB", "TiB"], 1.1e+12],
        [["Pb"], 1.407e+14],
        [["p", "P", "pb", "PB", "PiB"], 1.126e+15],
        [["Eb"], 1.441e+17],
        [["e", "E", "eb", "EB", "EiB"], 1.152e+18]
    ];

    var parsed = input.toString().match(/^([0-9\.,]*)(?:\s*)?(.*)$/);
    var amount = parsed[1];
    var unit = parsed[2];
    var validUnit = function (sourceUnit) {
        return sourceUnit === unit;
    };

    if (!validAmount(amount) || !parsableUnit(unit)) throw "Can't interpret "+(input || "a blank string");
    if (unit === '') return amount;

    for (var i = 0; i < increments.length; i++) {
        var _increment = increments[i];
        if (_increment[0].some(validUnit)) return amount*_increment[1];
    }

    throw unit+" doesn't appear to be a valid unit";
}
Utils.prototype.filesize = filesize;

module.exports = exports = new Utils();
