/**
 * Headless shell bootstrap.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals fs, webpage, probe, utils, shell, user, ghost, list, index */
"use strict";

if (!(typeof process !== 'undefined' && typeof process.send !== 'undefined') && typeof phantom === 'undefined') {
    console.error("Headless shell needs to be executed from a mothership");
}

// Globals
global.fs = require('fs'),
global.webpage = typeof phantom !== 'undefined' ? require('webpage') : null,
global.utils = require('./modules/utils'),
global.shell = require('./modules/'+(typeof phantom !== 'undefined' ? 'phantom' : 'node')+'/shell'),
global.user = shell.user,
global.ghost = shell.ghost,
global.list = shell.list,
global.index = shell.index;

// Shell config
utils.extend(shell, JSON.parse(shell.read(shell.join('shell', 'config.json'))));
if (ghost.memory && ghost.memory.shell) utils.extend(shell, ghost.memory.shell);
