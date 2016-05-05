/**
 * Headless shell functions.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals probe, utils, shell, user, ghost, list, index */
"use strict";

if (!(typeof process !== 'undefined' && typeof process.send !== 'undefined') && typeof phantom === 'undefined') {
    console.error("Headless shell needs to be executed from a mothership");
}

var debug = typeof phantom === 'undefined' ? require('debug')('headless:modules:shell') : function () {};

/**
 * Shell constructor.
 *
 * @constructor
 */
var Shell = function () {};
Shell.prototype.callbacks = [];
Shell.prototype.callbackid = 0;
Shell.prototype.queue = 0;
Shell.prototype.threads = [];
Shell.prototype.threadid = -1;

function receive(payload) {
    debug('receive  : '+(typeof payload === 'object' ? JSON.stringify(payload) : payload));
    if (typeof payload === 'string') payload = JSON.parse(payload);
    var message = payload.message,
        data = payload.data;
    switch (message) {
        case 'init':
            shell.send({
                message: 'data',
                data: {
                    args: {
                        error: null,
                        message: utils.format(
                            'Headless-%s-%s (%s)',
                            data.headlessVersion,
                            data.arch,
                            data.hostname
                        ),
                        progress: null
                    }
                }
            });
            shell.send({
                message: 'data',
                data: {
                    args: {
                        error: null,
                        message: utils.format(
                            'node/%s'+(typeof phantom !== 'undefined' ? ' phantomjs/%s' : '%s'),
                            data.version,
                            typeof phantom !== 'undefined' ? [phantom.version.major, phantom.version.minor, phantom.version.patch].join('.') : ''
                        )+'\n'+shell.read('MOTD'),
                        progress: null
                    }
                }
            });
            var i = index > -1 ? index : 0,
                length = index > -1 ? index+1 : list.list.items.length;
            try {
                for (; i < length; i++) shell.threads.push(new probe(data.id, ++shell.threadid, i, data.payload));
            } catch (err) {
                shell.error(err);
                shell.kill();
            }
            shell.threadid = -1;
            shell.next();
            break;
        case 'message':
            var index = data.index,
                i = index > -1 ? index : 0,
                length = index > -1 ? index+1 : list.list.items.length;
            for (; i < length; i++) shell.message(data.id, i, data.payload);
            break;
        case 'response':
            shell.callbacks[data.id](data.args.error, data.args);
            delete shell.callbacks[data.id];
            break;
        case 'kill':
            shell.kill();
            break;
    }
}
Shell.prototype.receive = receive;

function command(probe, name, args, callback) {
    debug('command  : '+name+'  '+JSON.stringify(args)+'  '+(typeof callback));
    if (name === 'log' || name === 'error') {
        if (name === 'error') {
            probe.searchid++;
            if (probe.searchid < probe.search.length) {
                args.error = null;
            } else if (probe.id === shell.threadid) {
                probe.loading = null;
            }
        }
        if (JSON.stringify({
            error: args.error,
            loading: probe.loading,
            message: args.message,
            progress: probe.progress,
            status: probe.status
        }) !== JSON.stringify(probe.shadow)) {
            shell.queue++;
            shell.callbacks[shell.callbackid] = function () {
                debug('log shellCallback');
                shell.exit(shell.queue);
            };
            shell.send({
                message: 'data',
                data: {
                    id: shell.callbackid,
                    command: 'log',
                    args: {
                        error: args.error,
                        loading: probe.loading,
                        message: args.message,
                        progress: probe.progress,
                        status: probe.status,
                        text: probe.item.text
                    }
                }
            });
            shell.callbackid++;
            probe.shadow = {
                error: args.error,
                loading: probe.loading,
                message: args.message,
                progress: probe.progress,
                status: probe.status
            };
        }
        if (name === 'error') {
            if (probe.searchid < probe.search.length) {
                shell.load(probe.id);
            } else if (probe.id === shell.threadid) {
                shell.next();
            }
        }
    } else if (name === 'box' || name === 'audio') {
        args.text = probe.item.text;
        shell.queue++;
        shell.callbacks[shell.callbackid] = function () {
            debug('box shellCallback');
            shell.exit(shell.queue);
        };
        shell.send({
            message: 'data',
            data: {
                id: shell.callbackid,
                command: name,
                args: args
            }
        });
        shell.callbackid++;
    } else if (name === 'session') {
        shell.queue++;
        shell.callbacks[shell.callbackid] = function (e, a) {
            debug('session shellCallback  : '+(typeof callback)+'  '+(typeof e === 'object' ? JSON.stringify(e) : e)+'  '+(typeof a === 'object' ? JSON.stringify(a) : a));
            if (callback) callback(e, a);
            shell.exit(shell.queue);
        };
        shell.send({
            message: 'session',
            data: {
                id: shell.callbackid,
                command: name,
                args: args
            }
        });
        shell.callbackid++;
    } else {
        shell.queue++;
        shell.callbacks[shell.callbackid] = function (e, a) {
            debug('request shellCallback  : '+(typeof callback)+'  '+(typeof e === 'object' ? JSON.stringify(e) : e)+'  '+(typeof a === 'object' ? JSON.stringify(a) : a));
            if (callback) callback(e, a);
            shell.exit(shell.queue);
        };
        shell.send({
            message: 'request',
            data: {
                id: shell.callbackid,
                command: name,
                args: args
            }
        });
        shell.callbackid++;
    }
}
Shell.prototype.command = command;

/**
 * Box helper.
 *
 * @param    {string} name User name
 * @param    {string} id Box
 * @param    {Object} box In a box
 */
function box(name, id, box) {
    debug('box  : '+name+'  '+id+'  '+JSON.stringify(box));
    return {
        name: name,
        message: 'data',
        data: {
            command: 'box',
            args: {
                id: id,
                boxes: box
            }
        }
    };
}
Shell.prototype.box = box;

function next() {
    debug('next  : '+shell.threadid);
    shell.threadid++;
    if (shell.threadid < shell.threads.length) {
        shell.load(shell.threadid);
    } else {
        var queue = null;
        for (var i = 0; i < shell.threads.length; i++) {
            if (shell.threads[i].length) {
                queue = true;
                break;
            }
        }
        if (!queue) shell.exit();
    }
}
Shell.prototype.next = next;

function load(id) {
    debug('load  : '+id+'  '+JSON.stringify(shell.threads[id]));
    var probe = shell.threads[id];
    try {
        probe.config = require(shell.path+'/shell/'+probe.shell+'/config/init.js');
/**
 * Init callback.
 *
 * @callback initCallback
 * @param    {undefined|Object|string} [out]
 * @param    {undefined|Object|string} [headers={'Content-Type':'application/json'}]
 * @param    {undefined|boolean} [stream] Stream out
 */
        probe.config.init(probe, probe.payload, function (out, headers, stream) {
            debug('initCallback  : '+(typeof out === 'object' ? JSON.stringify(out) : out)+'  '+headers+'  '+stream);
            if (probe.callbackid !== null && typeof out !== 'undefined') {
                var outheaders = {'Content-Type':'application/json'};
                if (typeof headers !== 'undefined') {
                    if (typeof headers !== 'object') {
                        outheaders['Content-Type'] = headers;
                    } else {
                        utils.extend(outheaders, headers);
                    }
                }
                shell.command(probe, 'out', {id:probe.callbackid, data:out, headers:outheaders, stream:stream});
                if (probe.run !== 'forever') shell.exit();
            }
        });
    } catch (err) {
        shell.error(err);
        shell.exit();
    }
}
Shell.prototype.load = load;

function message(callbackid, index, load) {
    debug('message  : '+callbackid+'  '+index+'  '+JSON.stringify(load)+'  '+JSON.stringify(shell.threads[index]));
    var probe = shell.threads[index];
    try {
/**
 * Message callback.
 *
 * @callback messageCallback
 * @param    {undefined|Object|string} [out]
 * @param    {undefined|Object|string} [headers={'Content-Type':'application/json'}]
 * @param    {undefined|boolean} [stream] Stream out
 */
        probe.script.message(probe, load, function (out, headers, stream) {
            debug('messageCallback  : '+(typeof out === 'object' ? JSON.stringify(out) : out)+'  '+headers+'  '+stream);
            if (callbackid !== null && typeof out !== 'undefined') {
                var outheaders = {'Content-Type':'application/json'};
                if (typeof headers !== 'undefined') {
                    if (typeof headers !== 'object') {
                        outheaders['Content-Type'] = headers;
                    } else {
                        utils.extend(outheaders, headers);
                    }
                }
                shell.command(probe, 'out', {id:callbackid, data:out, headers:outheaders, stream:stream});
            }
        });
    } catch (err) {
        shell.error(err);
    }
}
Shell.prototype.message = message;

function error(err) {
    debug('error  : '+(typeof err === 'object' ? JSON.stringify(err) : err));
    var match = (new RegExp('\\('+shell.path+'\/(.*):(.*):(.*)\\)', 'i')).exec(err.stack);
    if (!match) match = (new RegExp('\\('+shell.path+'\/(.*):(.*)\\)', 'i')).exec(err.stack);
    if (match) {
        shell.send({
            message: 'error',
            data: {
                path: match[1],
                line: parseInt(match[2], 10)-1,
                ch: match[3] ? parseInt(match[3], 10)-1 : null,
                message: err.message,
                stack: err.stack
            }
        });
    }
}
Shell.prototype.error = error;

function remember(probe, memory) {
    debug('remember  : '+JSON.stringify(memory));
    utils.extend(probe.memory.list[probe.item.text], memory);
    merge();
    return probe.memory.list[probe.item.text];
}
Shell.prototype.remember = remember;

function merge() {
    debug('merge  : '+JSON.stringify(ghost)+'  '+JSON.stringify(list.list));
    shell.write(shell.join(shell.path, 'users', user, 'config.json'), JSON.stringify(ghost));
    shell.write(list.path, JSON.stringify(list.list));
}
Shell.prototype.merge = merge;

module.exports = exports = new Shell();
