/**
 * Headless IP Address.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals shell */
"use strict";

var utils = require(shell.path+'/modules/utils'),
    Script = utils.Script(module.id, "IP Address");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    var payload = probe.payload;
    probe.log(exports.name);
    callback(payload.remoteAddress, 'text/plain');
}
Script.prototype.init = init;

module.exports = exports = new Script();
