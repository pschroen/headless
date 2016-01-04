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
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    var payload = probe.payload,
        origin = payload.origin,
        headers = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true'
        };
    probe.log(exports.name);

    // Retrieve username
    probe.session('username', function (error, args) {
        probe.log("Session response: "+JSON.stringify(args));

        // Store username, must be called before the callback
        probe.session('username', 'helloworld');

        // Retrieve username that we just stored
        probe.session('username', function (error, args) {
            probe.log("Session response: "+JSON.stringify(args));

            callback({
                title: exports.name,
                text: 'The Headless framework simply receives and sends JavaScript Objects as input and output. The name of this file is your endpoint, for example; <a href="/hello" target="_blank">/hello</a>.'
            }, headers);
        });
    });
}
Script.prototype.init = init;

module.exports = exports = new Script();
