/**
 * Headless node shell functions.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, indent:4 */
/* globals fs, utils, shell */
"use strict";

if (!(typeof process !== 'undefined' && typeof process.send !== 'undefined')) {
    console.error("Headless shell needs to be executed from a mothership");
}

var path = require('path');

var debug = require('debug')('headless:modules:node:shell');

var Shell = function () {};
utils.inherits(Shell, require('./files').constructor);

var user = process.argv[2].split(path.sep)[1],
    config = process.cwd()+path.sep+path.join('users', user, 'config.json');
Shell.prototype.user = user;
Shell.prototype.ghost = fs.existsSync(config) ? JSON.parse(fs.readFileSync(config).toString()) : {};
Shell.prototype.list = {path:process.argv[2], list:JSON.parse(fs.readFileSync(process.argv[2]).toString())};
Shell.prototype.index = parseInt(process.argv[3], 10);

function timeout(f, millisec) {
    return setTimeout(function () {f();}, millisec);
}
Shell.prototype.setTimeout = timeout;

function interval(f, millisec) {
    return setInterval(function () {f();}, millisec);
}
Shell.prototype.setInterval = interval;

// Node.js to Node.js bridge
function send(data) {
    debug('send  : '+JSON.stringify(data));
    process.send(data);
}
Shell.prototype.send = send;

function exit(exit) {
    debug('exit  : '+shell.queue);
    if (exit) {
        shell.queue--;
    } else if (!shell.queue) {
        process.exit();
    } else {
        timeout(function () {
            shell.exit();
        }, 1000);
    }
}
Shell.prototype.exit = exit;

function kill() {
    debug('kill');
    process.exit();
}
Shell.prototype.kill = kill;

process.on('message', function (payload) {
    shell.receive(payload);
});

module.exports = exports = new Shell();
