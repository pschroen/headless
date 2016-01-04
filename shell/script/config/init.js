/**
 * Headless Script Init.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals shell, user */
"use strict";

var utils = require('./utils'),
    Script = utils.Script(module.id, "Script Init");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    probe.log("["+exports.id+"] Loading "+exports.name);
    probe.script = require(shell.path+'/users/'+user+'/scripts/'+probe.item.text+'.js');
    probe.script.init(probe);
    if (callback) callback();
}
Script.prototype.init = init;

module.exports = exports = new Script();
