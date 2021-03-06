/**
 * Headless Audio Stream.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals shell */
"use strict";

var utils = require(shell.path+'/modules/utils'),
    Script = utils.Script(module.id, "Audio Stream");

var types = {
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'm4a': 'audio/x-m4a'
};

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|Object} [load] Payload
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, load, callback) {
    var src = load.src,
        type = types[shell.extname(src).substring(1)];
    probe.log("["+exports.id+"] Loading "+exports.name+" for "+src);
    callback(src, type, true);
}
Script.prototype.init = init;

module.exports = exports = new Script();
