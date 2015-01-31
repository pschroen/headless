/**
 * Headless probe instance.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

/**
 * Probe instance.
 *
 * @constructor
 * @param    {number} id Thread
 * @param    {number} i List item index
 * @param    {undefined|Object} [load] Payload
 */
function Probe(id, i, load) {
    "use strict";
    this.id = id;
    this.shell = list.list.shell;
    this.item = list.list.items[i];
    this.payload = load;
    if (!ghost.memory) ghost.memory = {};
    this.memory = ghost.memory;
    if (!this.memory.list) this.memory.list = {};
    if (!this.memory.list[this.item.text]) this.memory.list[this.item.text] = {};
    this.search = [];
    this.searchid = 0;
    this.list = [];
    this.length = 0;
    this.memoryid = [];
    this.shadow = null;
    this.loading = true;
    this.progress = null;
    this.status = null;
    this.log = function (message) {
        shell.command(this, 'log', {
            error: null,
            message: message
        });
    };
    this.error = function (message, error) {
        shell.command(this, 'error', {
            error: error || message,
            message: message
        });
    };
    this.get = function (args, callback) {
        shell.command(this, 'get', args, callback);
    };
    this.download = function (args, callback) {
        shell.command(this, 'download', args, callback);
    };
    this.post = function (args, callback) {
        shell.command(this, 'post', args, callback);
    };
    this.exec = function (args, callback) {
        shell.command(this, 'exec', args, callback);
    };
    this.reload = function () {
        this.list = [];
        this.length = 0;
        this.memoryid = [];
        shell.load(id);
    };
    this.next = function (message) {
        this.loading = null;
        this.log(message);
        shell.next();
    };
    this.exit = shell.exit;
    this.remember = function (memory) {
        return shell.remember(this, memory);
    };
    this.merge = shell.merge;
    this.box = function (message) {
        this.next(message);
        shell.command(this, 'box', this.item.infobox);
    };
}
module.exports = exports = Probe;
