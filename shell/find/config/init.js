/**
 * Headless Find Init.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

var utils = require('./utils'),
    Script = utils.Script(module.id, "Find Init");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    "use strict";
    probe.log("["+exports.id+"] Loading "+exports.name+" and searching for "+probe.item.text);
    if (callback) callback(files(probe, shell.path, new RegExp(utils.termsToPattern(probe.item.text), 'i')));
}
Script.prototype.init = init;

/**
 * Find files helper.
 *
 * @param    {Probe} probe Instance
 * @param    {string} dir Path
 * @param    {RegExp} pattern Regular expression
 * @param    {undefined|string} path Path match
 * @returns  {string}
 */
function files(probe, dir, pattern, path) {
    "use strict";
    var filenames = shell.readdir(dir);
    filenames.sort(function (a, b) {
        return a < b ? -1 : 1;
    });
    for (var i = 0; i < filenames.length; i++) {
        if (typeof path !== 'undefined') break;
        var file = filenames[i],
            fullpath = shell.join(dir, file);
        if (fs.lstatSync(fullpath).isDirectory()) {
            path = files(probe, fullpath, pattern, path);
        } else if (pattern.test(fullpath)) {
            path = fullpath;
            probe.log("["+exports.id+"] Found path "+path);
            break;
        }
    }
    return path;
}
Script.prototype.files = files;

module.exports = exports = new Script();
