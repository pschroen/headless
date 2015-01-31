/**
 * Headless API Init.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

var utils = require('./utils'),
    Script = utils.Script(module.id, "API Init");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    "use strict";
    probe.log("["+exports.id+"] Loading "+exports.name);
    probe.script = require(shell.path+'/users/'+user+'/apis/'+probe.item.text+'.js');
    probe.script.init(probe, function (out, type) {
        callback(out, type);
    });
}
Script.prototype.init = init;

module.exports = exports = new Script();