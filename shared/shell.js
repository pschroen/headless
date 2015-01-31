/**
 * Headless shell bootstrap.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

if (!(typeof process !== 'undefined' && typeof process.send !== 'undefined') && typeof phantom === 'undefined') {
    console.error("Headless shell needs to be executed from mothership");
}

// Globals
fs = require('fs'),
webpage = typeof phantom !== 'undefined' ? require('webpage') : null,
probe = require('./modules/probe'),
utils = require('./modules/utils'),
shell = require('./modules/'+(typeof phantom !== 'undefined' ? 'phantom' : 'node')+'/shell'),
user = shell.user,
ghost = shell.ghost,
list = shell.list,
index = shell.index;

// Shell config
utils.extend(shell, JSON.parse(shell.read(shell.join('shell', 'config.json'))));
if (ghost.memory && ghost.memory.shell) utils.extend(shell, ghost.memory.shell);
