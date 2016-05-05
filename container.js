/**
 * Headless shell container functions.
 *
 * Parts abducted from node-phantom's node-phantom.js.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, indent:4 */
/* globals os, fs, cp, http, request, util, url, ws, config, utils, shell, version, error:true, send */
"use strict";

if (typeof process === 'undefined') {
    console.error("Headless shell needs to be executed from a mothership");
}

var debug = require('debug')('headless:container');

var Shell = function (callbackid, container, user, list, index, load, session, callback) {
    debug('constructor  : '+callbackid+'  '+container+'  '+user.name+'  '+list+'  '+index+'  '+JSON.stringify(load)+'  '+JSON.stringify(session)+'  '+(typeof callback));
    this.container = container;
    this.callback = callback;
    try {
        this.list = JSON.parse(fs.readFileSync(list).toString());
    } catch (err) {
        var match = (new RegExp('\\('+shell.path+'\/(.*):(.*):(.*)\\)', 'i')).exec(err.stack);
        if (match) error = {
            path: list,
            line: 0,
            ch: 0,
            message: err.message,
            stack: err.stack
        };
    }
    var self = this;
    switch (this.container) {
        case 'node':
            var node = cp.fork('shell.js', [list, index]);
            node.on('message', function (payload) {
                debug('node message  : '+JSON.stringify(payload));
                var message = payload.message,
                    data = payload.data;
                switch (message) {
                    case 'request':
                        self[data.command](user, data, function (args) {
                            node.send({
                                message: 'response',
                                data: {
                                    id: data.id,
                                    command: data.command,
                                    args: args
                                }
                            });
                        });
                        break;
                    case 'data':
                        var args = data.args;
                        if (user) {
                            send(user.socket, {
                                name: user.name,
                                message: 'data',
                                data: data
                            });
                        }
                        if (data.command === 'log' || data.command === 'box') {
                            node.send({
                                message: 'response',
                                data: {
                                    id: data.id,
                                    command: data.command,
                                    args: args
                                }
                            });
                        }
                        if (args.error) error = args.error;
                        break;
                    case 'session':
                        var args = data.args;
                        if (session) {
                            if (typeof args.value !== 'undefined') {
                                session[args.name] = args.value;
                            } else if (typeof args.name !== 'object') {
                                args.value = session[args.name];
                            } else {
                                utils.extend(session, args.name);
                            }
                        }
                        node.send({
                            message: 'response',
                            data: {
                                id: data.id,
                                command: data.command,
                                args: args
                            }
                        });
                        if (args.error) error = args.error;
                        break;
                    case 'error':
                        if (user) {
                            send(user.socket, {
                                name: user.name,
                                message: 'error',
                                data: data
                            });
                        }
                        console.error(data.stack);
                        break;
                }
            });
            node.on('exit', function (code, signal) {
                debug('node exit  : '+code+'  '+signal);
                if (user) {
                    send(user.socket, {
                        name: user.name,
                        message: 'data',
                        data: {
                            args: {
                                error: error,
                                message: "Exited",
                                progress: 100
                            }
                        }
                    });
                }
                if (self.list.run === 'forever') {
                    if (user) {
                        util.log("Respawning "+list);
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: error,
                                    message: "Respawning",
                                    progress: 0
                                }
                            }
                        });
                    }
                    new Shell(callbackid, container, user, list, index, load, session, callback);
                }
            });
            node.send({
                message: 'init',
                data: {
                    id: callbackid,
                    headlessVersion: version,
                    version: process.version.substring(1),
                    arch: os.platform()+"-"+process.arch,
                    hostname: os.hostname(),
                    payload: load
                }
            });
            self.node = node;
            break;
        case 'phantom':
            var server = http.createServer(function (req, res) {
                res.writeHead(200, {'Content-Type':'text/html'});
                res.end("<html><head><script>\n\
                    var socket = new WebSocket('ws://'+location.host);\n\
                    socket.onopen = function (){\n\
                        alert(JSON.stringify({\n\
                            message: 'init',\n\
                            data: {\n\
                                id: "+callbackid+",\n\
                                headlessVersion: '"+version+"',\n\
                                version: '"+process.version.substring(1)+"',\n\
                                arch: '"+os.platform()+"-"+process.arch+"',\n\
                                hostname: '"+os.hostname()+"',\n\
                                payload: JSON.parse('"+utils.addslashes(JSON.stringify(load))+"')\n\
                            }\n\
                        }));\n\
                    };\n\
                    socket.onmessage = function (event){\n\
                        alert(event.data);\n\
                    };\n\
                </script></head><body></body></html>");
            }).listen(function () {
                var phantom = cp.spawn(config.phantomjs ? config.phantomjs : require('phantomjs').path, ['--ignore-ssl-errors=true', 'shell.js', server.address().port, list, index]);
                phantom.stdout.on('data', function (data) {
                    util.log("Phantom stdout: "+data);
                });
                phantom.stderr.on('data', function (data) {
                    console.error("Phantom stderr: "+data);
                });
                phantom.on('exit', function (code, signal) {
                    debug('phantom exit  : '+code+'  '+signal);
                    if (user) {
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: error,
                                    message: "Exited",
                                    progress: 100
                                }
                            }
                        });
                    }
                    server.close(function () {
                        if (self.list.run === 'forever') {
                            if (user) {
                                util.log("Respawning "+list);
                                send(user.socket, {
                                    name: user.name,
                                    message: 'data',
                                    data: {
                                        args: {
                                            error: error,
                                            message: "Respawning",
                                            progress: 0
                                        }
                                    }
                                });
                            }
                            var run = new Shell(container, user, list, index, load);
                        }
                    });
                });
                var wss = new ws.Server({server:server});
                wss.on('connection', function (socket) {
                    socket.on('message', function (payload) {
                        debug('phantom message  : '+payload);
                        payload = JSON.parse(payload);
                        var message = payload.message,
                            data = payload.data;
                        switch (message) {
                            case 'request':
                                self[data.command](user, data, function (args) {
                                    send(socket, {
                                        message: 'response',
                                        data: {
                                            id: data.id,
                                            command: data.command,
                                            args: args
                                        }
                                    });
                                });
                                break;
                            case 'data':
                                var args = data.args;
                                if (user) {
                                    send(user.socket, {
                                        name: user.name,
                                        message: 'data',
                                        data: data
                                    });
                                }
                                if (data.command === 'log' || data.command === 'box') {
                                    send(socket, {
                                        message: 'response',
                                        data: {
                                            id: data.id,
                                            command: data.command,
                                            args: args
                                        }
                                    });
                                }
                                if (args.error) error = args.error;
                                break;
                            case 'session':
                                var args = data.args;
                                if (session) {
                                    if (typeof args.value !== 'undefined') {
                                        session[args.name] = args.value;
                                    } else if (typeof args.name !== 'object') {
                                        args.value = session[args.name];
                                    } else {
                                        utils.extend(session, args.name);
                                    }
                                }
                                send(socket, {
                                    message: 'response',
                                    data: {
                                        id: data.id,
                                        command: data.command,
                                        args: args
                                    }
                                });
                                if (args.error) error = args.error;
                                break;
                            case 'error':
                                if (user) {
                                    send(user.socket, {
                                        name: user.name,
                                        message: 'error',
                                        data: data
                                    });
                                }
                                console.error(data.stack);
                                break;
                        }
                    });
                    self.socket = socket;
                });
                wss.on('close', function () {
                    console.error("Phantom control page disconnected");
                });
            });
            break;
        default:
            console.error("Container "+this.container+" not an option");
            return;
    }
};

function get(user, data, callback) {
    debug('get  : '+user.name+'  '+JSON.stringify(data)+'  '+(typeof callback));
    var args = data.args,
        options = {
            url: args.url
        };
    if (args.headers) options.headers = args.headers;
    request(options, function (error, response, body) {
        debug('get response  : '+error+'  '+response.statusCode+'  '+body);
        args.error = response.statusCode === 200 ? error : error || response.statusCode;
        args.body = body;
        args.headers = response.headers;
        callback(args);
    });
}
Shell.prototype.get = get;

function download(user, data, callback) {
    debug('download  : '+user.name+'  '+JSON.stringify(data)+'  '+(typeof callback));
    var args = data.args,
        uri = url.parse(args.url),
        options = {
            url: args.url
        };
    if (args.headers) options.headers = args.headers;
    request(options, function (error, response, body) {
        debug('download response  : '+error+'  '+response.statusCode);
        if (!error && response.statusCode === 200) {
            var dest = args.dest+'/'+(response.headers['content-disposition'] ? response.headers['content-disposition'].split('"')[1] : uri.path.replace(/.*\//, ''));
            response.pipe(fs.createWriteStream(dest)).on('finish', function () {
                args.error = error;
                args.dest = dest;
                args.headers = response.headers;
                callback(args);
            });
        } else {
            args.error = error || response.statusCode;
            args.dest = null;
            args.headers = response.headers;
            callback(args);
        }
    });
}
Shell.prototype.download = download;

function post(user, data, callback) {
    debug('post  : '+user.name+'  '+JSON.stringify(data)+'  '+(typeof callback));
    var args = data.args,
        options = {
            url: args.url,
            form: args.form
        };
    if (args.headers) options.headers = args.headers;
    request.post(options, function (error, response, body) {
        debug('post response  : '+error+'  '+response.statusCode+'  '+body);
        args.error = response.statusCode === 200 ? error : error || response.statusCode;
        args.body = body;
        args.headers = response.headers;
        callback(args);
    });
}
Shell.prototype.post = post;

function exec(user, data, callback) {
    debug('exec  : '+user.name+'  '+JSON.stringify(data)+'  '+(typeof callback));
    var args = data.args;
    cp.exec(args.command, args.options, function (error, stdout, stderr) {
        debug('exec response  : '+error+'  '+stdout+'  '+stderr);
        args.error = error;
        args.stdout = stdout;
        args.stderr = stderr;
        callback(args);
    });
}
Shell.prototype.exec = exec;

function out(user, data, callback) {
    /* jshint validthis:true */
    var self = this,
        args = data.args;
    debug('out  : '+user.name+'  '+JSON.stringify(data)+'  '+(typeof callback)+'  '+(typeof self.callback));
    if (self.callback) {
        if (user && args.stream) {
            fs.stat(args.data, function (err, stats) {
                if (!err) {
                    send(user.socket, {
                        name: user.name,
                        message: 'data',
                        data: {
                            args: {
                                error: null,
                                message: "Streaming "+stats.size+" bytes of data at "+config.streamrate+" bytes per second",
                                progress: null
                            }
                        }
                    });
                    self.callback(args.id, {stream:'start', headers:args.headers, length:stats.size});
                    var stream = fs.createReadStream(args.data).pipe(new (require('stream-throttle').Throttle)({rate:config.streamrate}));
                    stream.on('data', function (data) {
                        self.callback(args.id, {stream:'data', data:data.toString('base64')});
                    });
                    stream.on('end', function () {
                        self.callback(args.id, {stream:'end'});
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: null,
                                    message: "Stream end",
                                    progress: null
                                }
                            }
                        });
                        callback(args);
                    });
                } else {
                    self.callback(args.id, {data:args.data, headers:args.headers, stream:args.stream});
                    send(user.socket, {
                        name: user.name,
                        message: 'data',
                        data: {
                            args: {
                                error: null,
                                message: "Could not retrieve file "+args.data,
                                progress: null
                            }
                        }
                    });
                    callback(args);
                }
            });
        } else {
            self.callback(args.id, {data:args.data, headers:args.headers, stream:args.stream});
            callback(args);
        }
    } else {
        callback(args);
    }
}
Shell.prototype.out = out;

function message(callbackid, index, load) {
    /* jshint validthis:true */
    debug('message  : '+this.container+'  '+callbackid+'  '+index+'  '+JSON.stringify(load));
    switch (this.container) {
        case 'node':
            this.node.send({
                message: 'message',
                data: {
                    id: callbackid,
                    index: index,
                    payload: load
                }
            });
            break;
        case 'phantom':
            send(this.socket, {
                message: 'message',
                data: {
                    id: callbackid,
                    index: index,
                    payload: load
                }
            });
            break;
    }
}
Shell.prototype.message = message;

function kill() {
    /* jshint validthis:true */
    debug('kill  : '+this.container);
    switch (this.container) {
        case 'node':
            this.node.send({message:'kill'});
            break;
        case 'phantom':
            send(this.socket, {message:'kill'});
            break;
    }
}
Shell.prototype.kill = kill;

module.exports = exports = Shell;
