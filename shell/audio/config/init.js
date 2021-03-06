/**
 * Headless Audio Init.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals shell */
"use strict";

var utils = require('./utils'),
    Script = utils.Script(module.id, "Audio Init");

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
    probe.log("["+exports.id+"] Loading "+exports.name+" and searching for "+probe.item.text);
    var memory = probe.memory.list[probe.item.text],
        src = null,
        type = null;
    if (Object.keys(memory).length) {
        probe.log("["+exports.id+"] Found memory for "+probe.item.text+", "+JSON.stringify(memory));
        src = memory.src;
        type = memory.type;
        probe.log("["+exports.id+"] Playing "+src);
        probe.audio({src:src, type:type});
        probe.exit();
    } else {
        var find = require(shell.path+'/shell/find/config/init.js'),
            termstypes = [];
        for (var key in types) termstypes.push('\\.'+key);
        src = find.files(probe, shell.audio.path, new RegExp(utils.termsToPattern(probe.item.text+' '+termstypes.join('|')), 'i'), false);
        type = src ? types[shell.extname(src).substring(1)] : null;
        if (type) {
            probe.log("["+exports.id+"] Playing "+src);
            probe.audio({src:src, type:type});
            probe.exit();
        } else {
            probe.error("["+exports.id+"] No matches for audio types");
        }
    }
    if (callback) callback();
}
Script.prototype.init = init;

module.exports = exports = new Script();
