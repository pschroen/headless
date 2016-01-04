/**
 * Headless Find Init.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals fs, shell */
"use strict";

var utils = require('./utils'),
    Script = utils.Script(module.id, "Find Init");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
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
 * @param    {boolean} [dotfiles=true] Find hidden files
 * @param    {undefined|string} path Path match
 * @returns  {string}
 */
function files(probe, dir, pattern, dotfiles, path) {
    if (typeof dotfiles === 'undefined') dotfiles = true;
    var filenames = shell.readdir(dir);
    filenames.sort(function (a, b) {
        return a < b ? -1 : 1;
    });
    for (var i = 0; i < filenames.length; i++) {
        if (typeof path !== 'undefined') break;
        var file = filenames[i],
            fullpath = shell.join(dir, file);
        if (!(!dotfiles && /^\./.test(file))) {
            if (fs.lstatSync(fullpath).isDirectory()) {
                path = files(probe, fullpath, pattern, dotfiles, path);
            } else if (pattern.test(file)) {
                path = fullpath;
                probe.log("["+exports.id+"] Found file "+path);
                break;
            }
        }
    }
    return path;
}
Script.prototype.files = files;

module.exports = exports = new Script();
