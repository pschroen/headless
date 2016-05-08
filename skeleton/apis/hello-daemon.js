/**
 * Headless Hello World.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals shell */
"use strict";

var utils = require(shell.path+'/modules/utils'),
    Script = utils.Script(module.id, "Hello World");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|Object} [load] Payload
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, load, callback) {
    probe.log("["+exports.id+"] Loading "+exports.name);
    message(probe, load, callback);
}
Script.prototype.init = init;

/**
 * Message.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|Object} [load] Payload
 * @param    {undefined|initCallback} [callback]
 */
function message(probe, load, callback) {
    callback({
        title: exports.name,
        text: 'The Headless framework simply receives and sends JavaScript Objects as input and output. The name of this file is your webhook, for example; <a href="/hello" target="_blank">/hello</a>.'
    });
}
Script.prototype.message = message;

module.exports = exports = new Script();
