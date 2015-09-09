/**
 * Headless Hello World.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

var utils = require(shell.path+'/modules/utils'),
    Script = utils.Script(module.id, "Hello World");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    "use strict";
    var payload = probe.payload,
        name = payload.name,
        id = payload.id,
        box = {
            fields: {
                hello: {
                    type: 'info',
                    title: exports.name,
                    text: 'The Headless framework simply receives and sends JavaScript Objects as input and output. The name of this file is your endpoint, for example; <a href="/hello" target="_blank">/hello</a>.'
                },
                payload: {
                    type: 'info',
                    title: "Payload",
                    text: JSON.stringify(payload)
                }
            }
        };
    probe.log(exports.name);
    callback(shell.box(name, id, [box]));
}
Script.prototype.init = init;

module.exports = exports = new Script();
