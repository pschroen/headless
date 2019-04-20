/**
 * Headless.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, indent:4 */
/* globals os, fs, cp, path, http, https, connect, request, util, url, querystring, file, ws, bcrypt, uuid, isbinaryfile,
    config, utils, files, container, shell, version, error:true, send */
"use strict";

if (typeof process === 'undefined') {
    console.error("Headless daemon needs to be executed with node");
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// TODO: http://nodejs.org/api/domain.html
process.on('uncaughtException', function (err) {
    console.error("UncaughtException: "+err.stack);
});

// Globals
global.os = require('os'),
global.fs = require('fs'),
global.cp = require('child_process'),
global.path = require('path'),
global.http = require('http'),
global.https = require('https'),
global.connect = require('connect'),
global.request = require('request'),
global.url = require('url'),
global.querystring = require('querystring'),
global.file = new (require('node-static')).Server('./mothership'),
global.ws = require('ws'),
global.bcrypt = require('bcrypt'),
global.uuid = require('node-uuid'),
global.isbinaryfile = require('isbinaryfile');

global.config = require('./config'),
global.utils = require('./modules/utils'),
global.files = require('./modules/node/files'),
global.container = require('./container'),
global.shell = JSON.parse(files.read(path.join('shell', 'config.json'))),
global.version = JSON.parse(files.read('package.json')).version,
// TODO: Better error handling
global.error = null;

var debug = require('debug')('headless');

global.send = function (socket, data) {
    debug('send  : '+JSON.stringify(data));
    if (socket) {
        socket.send(JSON.stringify(data), function (err) {
            if (err && err.message !== 'not opened' && process.env.NODE_ENV !== 'production') console.error(err.stack);
        });
    }
};

if (config.http) {
    http.createServer(function (req, res) {
        req.on('end', function (error) {
            res.writeHead(302, {
                'Location': 'https://'+(config.https !== 443 && !config.proxied ? url.parse('http://'+req.headers.host).hostname+':'+config.https : req.headers.host)+req.url
            });
            res.end();
        }).resume();
    }).listen(config.http, config.ip);
}

var insert = [],
    keys = [],
    users = {},
    callbacks = [],
    callbackid = 0,
    minutes = (config.heartbeat/1000/60)<<0,
    seconds = (config.heartbeat/1000)%60,
    device = null,
    setup = null,
    heartbeat = null,
    intervals = [],
    server = null,
    wss = null,
    daemons = {};

var init = function () {
    debug('init');
    var app = connect();
    app.use(require('compression')());
    app.use(require('cookie-session')({secret:config.cookiesecret}));

    app.use(function (req, res) {
        var body = '';
        req.on('data', function (chunk) {
            body += chunk;
        }).on('end', function (error) {
            var match = /(.*)\.headless\.io/.exec(req.headers.host),
                filepath = './mothership'+req.url;
            if (!match && /headless\.io/.test(req.headers.host) && req.url === '/') {
                file.serveFile('/install/index.html', 200, {}, req, res);
                return;
            }
            if (!files.exists(filepath)) {
                var name = match && /\./.test(match[1]) ? match[1].split('.')[0] : match ? match[1] : null;
                if (match && users[name] && users[name].host) {
                    var uri = url.parse(req.url),
                        load = body.length ? querystring.parse(body) : {};
                    utils.extend(load, querystring.parse(uri.query));
                    load.remoteAddress = req.socket.remoteAddress;
                    load.origin = req.headers.origin;
                    callbacks[callbackid] = {};
                    callbacks[callbackid].session = function (out) {
                        if (typeof out.value !== 'undefined') {
                            req.session[out.name] = out.value;
                        } else if (typeof out.name !== 'object') {
                            out.value = req.session[out.name];
                        } else {
                            utils.extend(req.session, out.name);
                        }
                        send(users[name].host, {
                            id: out.callbackid,
                            message: 'session',
                            data: out
                        });
                    };
                    callbacks[callbackid].callback = function (out) {
                        var data = null;
                        if (!out.stream) {
                            data = out.data;
                            if (out.headers['Content-Type'] === 'application/json') data = JSON.stringify(out.data, null, '\t');
                        }
                        if (!out.stream || out.stream === 'start') {
                            res.writeHead(200, utils.extend(out.headers, {'Content-Length': out.length ? out.length : data.length}));
                        }
                        if (!out.stream) {
                            res.write(data);
                        } else if (out.stream === 'data') {
                            res.write(new Buffer(data, 'base64'));
                        }
                        if (!out.stream || out.stream === 'end') res.end();
                    };
                    send(users[name].host, {
                        id: callbackid,
                        type: 'http',
                        message: 'hook',
                        data: {
                            submit: uri.pathname.substring(1),
                            payload: load
                        },
                        time: Date.now()
                    });
                    callbackid++;
                } else {
                    var userslist = files.readdir('users');
                    userslist.forEach(function (name) {
                        var lists = path.join('users', name, 'lists');
                        if (files.exists(lists)) {
                            var listslist = files.lists(lists);
                            listslist.forEach(function (list) {
                                if (list.list.shell === 'api') {
                                    for (var i = 0; i < list.list.items.length; i++) {
                                        var item = list.list.items[i],
                                            uri = url.parse(req.url);
                                        if ('/'+item.text === uri.pathname) {
                                            var load = body.length ? querystring.parse(body) : {};
                                            utils.extend(load, querystring.parse(uri.query));
                                            load.remoteAddress = req.socket.remoteAddress;
                                            load.origin = req.headers.origin;
                                            if (process.env.NODE_ENV !== 'production') utils.log("HTTP webhook "+uri.pathname+" > "+load.remoteAddress);
                                            callbacks[callbackid] = {};
                                            callbacks[callbackid].session = function (out) {
                                                if (typeof out.value !== 'undefined') {
                                                    req.session[out.name] = out.value;
                                                } else if (typeof out.name !== 'object') {
                                                    out.value = req.session[out.name];
                                                } else {
                                                    utils.extend(req.session, out.name);
                                                }
                                                this.api.callbacks[out.id]({name:out.name, value:out.value});
                                            };
                                            callbacks[callbackid].callback = function (out) {
                                                var data = null;
                                                if (!out.stream) {
                                                    data = out.data;
                                                    if (out.headers['Content-Type'] === 'application/json') data = JSON.stringify(out.data, null, '\t');
                                                }
                                                if (!out.stream || out.stream === 'start') {
                                                    res.writeHead(200, utils.extend(out.headers, {'Content-Length': out.length ? out.length : data.length}));
                                                }
                                                if (!out.stream) {
                                                    res.write(data);
                                                } else if (out.stream === 'data') {
                                                    res.write(new Buffer(data, 'base64'));
                                                }
                                                if (!out.stream || out.stream === 'end') res.end();
                                            };
                                            var api = null;
                                            if (!daemons[name]) {
                                                api = new container(list.list.container, users[name], list.path, i, {id:callbackid, type:'http', data:load}, function (id, out) {
                                                    debug('local http sessionCallback  : '+id+'  '+JSON.stringify(out));
                                                    callbacks[id].session(out);
                                                }, function (id, out) {
                                                    debug('local http apiCallback  : '+id+'  '+JSON.stringify(out));
                                                    callbacks[id].callback(out);
                                                    if (!out.stream || out.stream === 'end') delete callbacks[id];
                                                });
                                                if (list.list.shell === 'api' && list.list.run === 'forever') daemons[name] = api;
                                            } else {
                                                api = daemons[name];
                                                api.message(i, {id:callbackid, type:'http', data:load});
                                            }
                                            callbacks[callbackid].api = api;
                                            callbackid++;
                                            break;
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            } else {
                file.serve(req, res);
            }
        }).resume();
    });

    server = https.createServer({
        key: files.read('headless-key.pem'),
        cert: files.read('headless-cert.pem')
    }, app).listen(config.https, config.ip, function () {
        wss = new ws.Server({server:server});
        wss.on('connection', function (socket) {
            debug('connection  : '+socket.upgradeReq.headers['user-agent']);
            if (socket.upgradeReq.headers['user-agent']) {
                if (process.env.NODE_ENV !== 'production') utils.log("Hello "+socket._socket.remoteAddress);
                socket.on('message', function (payload) {
                    receive(socket, payload);
                });
                socket.on('close', function () {
                    if (users[socket._socket.remoteAddress] && users[socket._socket.remoteAddress].socket) delete users[socket._socket.remoteAddress].socket;
                    if (users[socket._socket.remoteAddress] && !users[socket._socket.remoteAddress].setup) delete users[socket._socket.remoteAddress];
                });
            } else {
                socket.on('message', function (payload) {
                    payload = JSON.parse(payload);
                    var message = payload.message,
                        data = payload.data;
                    switch (message) {
                        case 'mothership':
                            if (data.key) {
                                if (keys.indexOf(data.key) > -1) {
                                    socket.users = data.users;
                                    data.users.forEach(function (user) {
                                        var name = user.name,
                                            auth = path.join('users', name, 'auth.json');
                                        if (files.exists(auth)) {
                                            if (keys.indexOf(user.key) > -1) {
                                                if (user.keys) {
                                                    keys = keys.replace(user.key, user.keys);
                                                    user.key = user.keys;
                                                    delete user.keys;
                                                    var userauth = JSON.parse(files.read(auth));
                                                    utils.extend(userauth, user);
                                                    files.write(auth, JSON.stringify(userauth));
                                                }
                                                if (!users[name]) users[name] = {name:name};
                                                users[name].host = socket;
                                                if (process.env.NODE_ENV !== 'production') utils.log("Hello "+socket._socket.remoteAddress+" > "+name);
                                            }
                                        }
                                    });
                                }
                            } else if (users[socket._socket.remoteAddress] && users[socket._socket.remoteAddress].socket) {
                                users[socket._socket.remoteAddress].host = socket;
                                send(users[socket._socket.remoteAddress].socket, {
                                    message: 'setup',
                                    data: {
                                        hostname: data.hostname,
                                        localhost: data.localhost
                                    },
                                    time: payload.time
                                });
                            }
                            break;
                        case 'session':
                            debug('remote sessionCallback  : '+payload.id+'  '+JSON.stringify(data));
                            callbacks[payload.id].session(data);
                            break;
                        case 'hook':
                            var match = /(.*)\.headless\.io/.exec(socket.upgradeReq.headers.host),
                                name = match && /\./.test(match[1]) ? match[1].split('.')[0] : match ? match[1] : null;
                            if (match && users[name] && users[name].host) {
                                if (!data.remoteAddress) data.remoteAddress = socket._socket.remoteAddress;
                                callbacks[callbackid] = function (out) {
                                    send(socket, {
                                        message: 'hook',
                                        data: out.data,
                                        time: payload.time
                                    });
                                };
                                send(users[name].host, {
                                    id: callbackid,
                                    type: 'ws',
                                    message: 'hook',
                                    data: {
                                        submit: socket.upgradeReq.url.substring(1),
                                        payload: data
                                    },
                                    time: Date.now()
                                });
                                callbackid++;
                            } else {
                                if (isFinite(payload.id)) {
                                    debug('remote '+payload.type+' apiCallback  : '+payload.id+'  '+JSON.stringify(data));
                                    callbacks[payload.id].callback(data);
                                    if (!data.stream || data.stream === 'end') delete callbacks[payload.id];
                                } else {
                                    var userslist = files.readdir('users');
                                    userslist.forEach(function (name) {
                                        var lists = path.join('users', name, 'lists');
                                        if (files.exists(lists)) {
                                            var listslist = files.lists(lists);
                                            listslist.forEach(function (list) {
                                                if (list.list.shell === 'api') {
                                                    for (var i = 0; i < list.list.items.length; i++) {
                                                        var item = list.list.items[i];
                                                        if ('/'+item.text === socket.upgradeReq.url) {
                                                            if (!data.remoteAddress) data.remoteAddress = socket._socket.remoteAddress;
                                                            if (process.env.NODE_ENV !== 'production') utils.log("WS webhook "+socket.upgradeReq.url+" > "+data.remoteAddress);
                                                            callbacks[callbackid] = {};
                                                            callbacks[callbackid].callback = function (out) {
                                                                if (out.data.message === 'data' && out.data.data.command === 'box' &&
                                                                    out.data.data.args.boxes[0].data &&
                                                                    out.data.data.args.boxes[0].data.insert
                                                                ) {
                                                                    var user = JSON.parse(files.read(path.join('users', out.data.name, 'auth.json')));
                                                                    users[out.data.name] = {name:out.data.name};
                                                                    keys = keys+'|'+user.key;
                                                                }
                                                                send(socket, {
                                                                    message: 'hook',
                                                                    data: out.data,
                                                                    time: payload.time
                                                                });
                                                            };
                                                            var api = null;
                                                            if (!daemons[name]) {
                                                                api = new container(list.list.container, users[name], list.path, i, {id:callbackid, type:'ws', data:data}, null, function (id, out) {
                                                                    debug('local ws apiCallback  : '+id+'  '+JSON.stringify(out));
                                                                    callbacks[id].callback(out);
                                                                    if (!out.stream || out.stream === 'end') delete callbacks[id];
                                                                });
                                                                if (list.list.shell === 'api' && list.list.run === 'forever') daemons[name] = api;
                                                            } else {
                                                                api = daemons[name];
                                                                api.message(i, {id:callbackid, type:'ws', data:data});
                                                            }
                                                            callbacks[callbackid].api = api;
                                                            callbackid++;
                                                            break;
                                                        }
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                            break;
                        case 'heartbeat':
                            send(socket, {
                                message: 'heartbeat',
                                time: payload.time
                            });
                            break;
                        default:
                            if (payload.name && users[payload.name] && users[payload.name].socket)
                                send(users[payload.name].socket, payload);
                            break;
                    }
                });
                socket.on('close', function () {
                    if (users[socket._socket.remoteAddress] && users[socket._socket.remoteAddress].setup) {
                        clearInterval(users[socket._socket.remoteAddress].setup);
                        delete users[socket._socket.remoteAddress].setup;
                    }
                    if (users[socket._socket.remoteAddress] && !users[socket._socket.remoteAddress].socket) delete users[socket._socket.remoteAddress];
                    if (socket.users) {
                        socket.users.forEach(function (user) {
                            var name = user.name;
                            if (users[name] && users[name].socket) users[name].socket.close();
                        });
                    }
                });
            }
        });
        utils.log("Headless daemon listening on https://"+server.address().address+":"+server.address().port);
    });

    var userslist = files.exists('users') ? files.readdir('users') : [];
    userslist.forEach(function (name) {
        users[name] = {name:name};
        var lists = path.join('users', name, 'lists');
        if (files.exists(lists)) {
            var listslist = files.lists(lists);
            listslist.forEach(function (list) {
                if (list.list.run) {
                    if (typeof list.list.run === 'number') {
                        var hours = (list.list.run/1000/60/60)<<0,
                            minutes = (list.list.run/1000/60)%60*60,
                            seconds = (list.list.run/1000)%60;
                        var loop = function () {
                            utils.log("Running "+list.path+" with "+hours+" hour"+(minutes ? " "+minutes+" minute" : "")+(seconds ? " "+seconds+" second" : "")+" interval");
                            new container(list.list.container, users[name], list.path, -1, null, null, null);
                        };
                        intervals.push(setInterval(loop, list.list.run));
                        loop();
                    } else {
                        utils.log("Running "+list.path);
                        var run = new container(list.list.container, users[name], list.path, -1, null, function (id, out) {
                            debug('local daemon sessionCallback  : '+id+'  '+JSON.stringify(out));
                            callbacks[id].session(out);
                        }, function (id, out) {
                            debug('local daemon apiCallback  : '+id+'  '+JSON.stringify(out));
                            callbacks[id].callback(out);
                            if (!out.stream || out.stream === 'end') delete callbacks[id];
                        });
                        if (list.list.shell === 'api' && list.list.run === 'forever') daemons[name] = run;
                    }
                }
            });
        }
    });

    insert = [],
    keys = [];
    userslist.forEach(function (name) {
        var auth = path.join('users', name, 'auth.json');
        if (files.exists(auth)) {
            var user = JSON.parse(files.read(auth));
            insert.push({
                name: user.name,
                auth: user.auth,
                key: user.key
            });
            keys.push(user.key);
        }
    });

    mothership(insert);
    keys = keys.join('|');

    debug('init');
};

function receive(socket, payload, response_url) {
    debug('receive  : '+payload+'  '+response_url);
    payload = JSON.parse(payload);
    var message = payload.message,
        data = payload.data;
    switch (message) {
        case 'request':
            if (data.auth) {
                var name = data.name,
                    auth = path.join('users', name, 'auth.json'),
                    user = files.exists(auth) ? JSON.parse(files.read(auth)) : null;
                if (user && bcrypt.compareSync(data.auth, '$2a$08$'+user.auth)) {
                    if (!response_url) socket.user = user;
                    if (!socket.users) socket.users = {};
                    if (!socket.users[name]) socket.users[name] = {};
                    socket.users[name].handshake = true;
                    if (!users[name]) users[name] = {name:name};
                    users[name].socket = socket;
                    if (!user.host) {
                        if (users[name].host) {
                            send(users[name].host, payload);
                        } else {
                            send(socket, {
                                name: name,
                                message: 'response',
                                data: {
                                    auth: true
                                },
                                time: payload.time
                            });
                        }
                    } else {
                        var ghostconfig = path.join('users', name, 'config.json'),
                            ghost = files.exists(ghostconfig) ? JSON.parse(files.read(ghostconfig)) : {};
                        ghost.userAgent = data.userAgent;
                        files.write(ghostconfig, JSON.stringify(ghost));
                        if (ghost.memory) delete ghost.memory;
                        if (ghost.userAgent) delete ghost.userAgent;
                        var lists = path.join('users', name, 'lists');
                        send(socket, {
                            name: name,
                            message: 'response',
                            data: {
                                auth: true,
                                ghost: ghost,
                                lists: files.exists(lists) ? files.lists(lists) : [],
                                hostname: os.hostname(),
                                localhost: socket._socket.address().address+':'+server.address().port,
                                platform: process.platform
                            },
                            time: payload.time
                        });
                        if (error) {
                            send(socket, {
                                name: name,
                                message: 'error',
                                data: error
                            });
                            error = null;
                        }
                    }
                } else {
                    send(socket, {
                        name: name,
                        message: 'response',
                        data: {
                            auth: false
                        },
                        time: payload.time
                    });
                }
            } else {
                var name = socket.user ? socket.user.name : payload.name && socket.users[payload.name].handshake ? payload.name : null;
                if (name && users[name] && users[name].socket && users[name].host) {
                    payload.name = name;
                    send(users[name].host, payload);
                } else if (name && users[name] && users[name].socket) {
                    for (var x in data) {
                        switch (x) {
                            case 'load':
                                var load = {};
                                for (var key in data.load) {
                                    var val = data.load[key];
                                    if (files.exists(val)) {
                                        if (val === 'users') {
                                            load[key] = files.readdir(val);
                                            var offset = 0;
                                            for (var i = 0; i < load[key].length; i++) {
                                                if (!fs.lstatSync(path.join('users', load[key][i])).isDirectory()) {
                                                    load[key].splice(i-offset, 1);
                                                    offset++;
                                                }
                                            }
                                        } else if (fs.lstatSync(val).isDirectory()) {
                                            load[key] = files.files(val);
                                        } else {
                                            load[key] = !isbinaryfile.sync(val) ? files.read(val).toString() : 'binary';
                                            if (/\.json$/.exec(val)) load[key] = JSON.stringify(JSON.parse(load[key]), null, '\t');
                                        }
                                    }
                                }
                                send(socket, {
                                    name: name,
                                    message: 'data',
                                    data: {
                                        load: load
                                    }
                                });
                                break;
                            case 'save':
                                for (var key in data.save) {
                                    var val = data.save[key];
                                    if (key === path.join('users', name, 'config.json')) {
                                        var ghost = files.exists(key) ? JSON.parse(files.read(key)) : {};
                                        utils.extend(ghost, val);
                                        val = ghost;
                                    } else {
                                        files.mkdir(path.dirname(key));
                                    }
                                    if (/\.json$/.exec(key) && typeof val === 'object') val = JSON.stringify(val);
                                    files.write(key, val);
                                }
                                var operation = false;
                                for (var key in data.save) {
                                    var val = data.save[key];
                                    if ((new RegExp(path.join('users', name, 'lists'))).test(key)) {
                                        if (files.exists(key)) {
                                            var list = JSON.parse(fs.readFileSync(key).toString());
                                            if (!files.exists(path.join('shell', list.shell))) {
                                                var git = config.git ? config.git : 'git',
                                                    command = !files.exists(path.join('shell', '.git')) ? 'cd shell && \
                                                    '+git+' init && \
                                                    '+git+' remote add origin https://github.com/pschroen/shell.git && \
                                                    '+git+' config core.sparsecheckout true && \
                                                    echo /'+list.shell+'/ >> .git/info/sparse-checkout && \
                                                    '+git+' pull origin stable' : 'cd shell && \
                                                    echo /'+list.shell+'/ >> .git/info/sparse-checkout && \
                                                    '+git+' read-tree -mu HEAD && \
                                                    '+git+' pull origin stable';
                                                debug('shell save  : '+command);
                                                var log = "Installing shell "+list.shell;
                                                utils.log(log);
                                                send(socket, {
                                                    name: name,
                                                    message: 'data',
                                                    data: {
                                                        args: {
                                                            error: null,
                                                            loading: true,
                                                            message: log
                                                        }
                                                    }
                                                });
                                                operation = true;
                                                cp.exec(command, function (error, stdout, stderr) {
                                                    if (!error) {
                                                        var log = "Install of shell "+list.shell+" complete";
                                                        utils.log(log);
                                                        send(socket, {
                                                            name: name,
                                                            message: 'data',
                                                            data: {
                                                                args: {
                                                                    error: null,
                                                                    loading: false,
                                                                    message: log
                                                                }
                                                            }
                                                        });
                                                    } else {
                                                        var log = "Install of shell "+list.shell+" failed with "+error;
                                                        utils.log(log);
                                                        send(socket, {
                                                            name: name,
                                                            message: 'data',
                                                            data: {
                                                                args: {
                                                                    error: true,
                                                                    loading: false,
                                                                    message: log
                                                                }
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                                if (!operation) {
                                    send(socket, {
                                        name: name,
                                        message: 'data',
                                        data: {
                                            args: {
                                                error: null,
                                                loading: false,
                                                message: "Merged"
                                            }
                                        }
                                    });
                                }
                                break;
                            case 'move':
                                var count = 0;
                                for (var key in data.move) {
                                    var val = data.move[key];
                                    if (files.exists(key)) {
                                        if (val !== '') {
                                            if (count % 2 === 0) {
                                                files.move(key, val);
                                            } else {
                                                if (/\.json$/.exec(key) && typeof val === 'object') val = JSON.stringify(val);
                                                files.write(key, val);
                                            }
                                            count++;
                                        } else if (fs.lstatSync(key).isDirectory()) {
                                            files.rmdir(key, true);
                                        } else {
                                            fs.unlinkSync(key);
                                            files.rmdirEmpty(path.dirname(key));
                                        }
                                    }
                                }
                                send(socket, {
                                    name: name,
                                    message: 'data',
                                    data: {
                                        args: {
                                            error: null,
                                            loading: false,
                                            message: "Merged"
                                        }
                                    }
                                });
                                break;
                            case 'hash':
                                var ghostconfig = path.join('users', name, 'config.json'),
                                    ghost = files.exists(ghostconfig) ? JSON.parse(files.read(ghostconfig)) : {};
                                if (ghost.memory) delete ghost.memory;
                                if (ghost.userAgent) delete ghost.userAgent;
                                var lists = path.join('users', name, 'lists');
                                send(socket, {
                                    name: name,
                                    message: 'hash',
                                    data: {
                                        auth: true,
                                        ghost: ghost,
                                        lists: files.exists(lists) ? files.lists(lists) : [],
                                        hostname: os.hostname(),
                                        localhost: socket._socket.address().address
                                    },
                                    time: payload.time
                                });
                                if (error) {
                                    send(socket, {
                                        name: name,
                                        message: 'error',
                                        data: error
                                    });
                                    error = null;
                                }
                                break;
                            case 'list':
                                if (!users[name].containers) users[name].containers = [];
                                users[name].containers.push(new container(data.container, users[name], data.list, data.index, null, null, null));
                                break;
                            case 'kill':
                                var contain = users[name].containers ? users[name].containers[users[name].containers.length-1] : null;
                                if (contain) contain.kill();
                                break;
                            case 'restart':
                                if (response_url) {
                                    socket.removeAllListeners('close');
                                    socket.close();
                                }
                                for (var user in users) {
                                    if (user.containers) {
                                        user.containers.forEach(function (contain) {
                                            if (contain) contain.kill();
                                        });
                                    }
                                }
                                if (config.restart) {
                                    utils.log("Restarting with "+config.restart);
                                    cp.exec(config.restart);
                                } else {
                                    utils.log("Forcing restart by quitting");
                                    process.exit();
                                }
                                break;
                            case 'pass':
                                var name = data.pass.name,
                                    auth = path.join('users', name, 'auth.json'),
                                    user = JSON.parse(files.read(auth));
                                utils.log("Updating "+name+"'s password");
                                user.auth = bcrypt.hashSync(data.pass.auth, 8).substring(7);
                                user.keys = bcrypt.hashSync(uuid.v4(), 8).substring(7);
                                files.write(auth, JSON.stringify(user));
                                reinsert();
                                send(socket, {
                                    name: name,
                                    message: 'data',
                                    data: {
                                        args: {
                                            error: null,
                                            loading: false,
                                            message: "Merged"
                                        }
                                    }
                                });
                                break;
                            case 'api':
                                if (data.api.submit === 'headless.io/namespace' || data.api.submit === 'headless.io/release')
                                    data.api.user = JSON.parse(files.read(path.join('users', data.api.name, 'auth.json')));
                                hook(data.api, function (out) {
                                    send(socket, out);
                                    if (out.message === 'data' && out.data.command === 'box' &&
                                        out.data.args.boxes[0].data &&
                                        out.data.args.boxes[0].data.insert
                                    ) reinsert();
                                });
                                break;
                        }
                    }
                } else {
                    send(socket, {
                        name: name,
                        message: 'response',
                        data: {
                            auth: false
                        },
                        time: payload.time
                    });
                }
            }
            break;
        case 'session':
            debug('local sessionCallback  : '+payload.id+'  '+JSON.stringify(data));
            callbacks[payload.id].api.callbacks[data.id]({name:data.name, value:data.value});
            break;
        case 'hook':
            var userslist = files.readdir('users');
            userslist.forEach(function (name) {
                var lists = path.join('users', name, 'lists');
                if (files.exists(lists)) {
                    var listslist = files.lists(lists);
                    listslist.forEach(function (list) {
                        if (list.list.shell === 'api') {
                            for (var i = 0; i < list.list.items.length; i++) {
                                var item = list.list.items[i];
                                if (item.text === data.submit) {
                                    var url = response_url,
                                        callback = new ws(url);
                                    if (!data.payload.remoteAddress) data.payload.remoteAddress = socket._socket.remoteAddress;
                                    if (process.env.NODE_ENV !== 'production') utils.log("Received webhook "+url+"/"+data.submit+" > "+data.payload.remoteAddress);
                                    callback.on('open', function () {
                                        if (process.env.NODE_ENV !== 'production') utils.log("Sending data to callback "+url);
                                        callbacks[callbackid] = {};
                                        callbacks[callbackid].session = function (out) {
                                            send(callback, {
                                                id: payload.id,
                                                message: 'session',
                                                data: out
                                            });
                                        };
                                        callbacks[callbackid].callback = function (out) {
                                            send(callback, {
                                                id: payload.id,
                                                message: 'hook',
                                                data: out,
                                                time: payload.time
                                            });
                                            if (!out.stream || out.stream === 'end') {
                                                if (process.env.NODE_ENV !== 'production') utils.log("Send complete, closing connection");
                                                callback.close();
                                            }
                                        };
                                        var api = null;
                                        if (!daemons[name]) {
                                            api = new container(list.list.container, users[name], list.path, i, {id:callbackid, type:payload.type, data:data.payload}, function (id, out) {
                                                debug('local '+payload.type+' sessionCallback  : '+id+'  '+JSON.stringify(out));
                                                callbacks[id].session(out);
                                            }, function (id, out) {
                                                debug('local '+payload.type+' apiCallback  : '+id+'  '+JSON.stringify(out));
                                                callbacks[id].callback(out);
                                                if (!out.stream || out.stream === 'end') delete callbacks[id];
                                            });
                                            if (list.list.shell === 'api' && list.list.run === 'forever') daemons[name] = api;
                                        } else {
                                            api = daemons[name];
                                            api.message(i, {id:callbackid, type:payload.type, data:data.payload});
                                        }
                                        callbacks[callbackid].api = api;
                                        callbackid++;
                                    });
                                    callback.on('error', function (err) {
                                        if (process.env.NODE_ENV !== 'production') utils.log("Callback "+url+" failed with "+err);
                                    });
                                    break;
                                }
                            }
                        }
                    });
                }
            });
            break;
        case 'heartbeat':
            if (!response_url) {
                send(socket, {
                    message: 'heartbeat',
                    time: payload.time
                });
            } else {
                utils.log("Heartbeat with "+(Date.now()-payload.time)+"ms latency");
            }
            break;
        case 'setup':
            if (!response_url) {
                if (!data) {
                    if (process.env.NODE_ENV !== 'production') utils.log("Setup "+socket._socket.remoteAddress+" socket");
                    if (!users[socket._socket.remoteAddress]) users[socket._socket.remoteAddress] = {};
                    users[socket._socket.remoteAddress].socket = socket;
                } else if (users[socket._socket.remoteAddress] && users[socket._socket.remoteAddress].host) {
                    send(users[socket._socket.remoteAddress].host, payload);
                }
            } else if (data && !files.exists('users')) {
                var name = data.name,
                    auth = path.join('users', name, 'auth.json'),
                    ghostconfig = path.join('users', name, 'config.json');
                files.cpdir('skeleton', path.join('users', name));
                files.write(auth, JSON.stringify({
                    name: name,
                    auth: bcrypt.hashSync(data.auth, 8).substring(7),
                    key: bcrypt.hashSync(uuid.v4(), 8).substring(7),
                    host: true
                }));
                files.write(ghostconfig, JSON.stringify({
                    view: {
                        list: false,
                        lists: false,
                        files: false,
                        users: false,
                        log: false
                    },
                    files: [{
                        name: "Ghost",
                        path: path.join('users', name)
                    }, {
                        name: "Shell",
                        path: 'shell'
                    }],
                    userAgent: data.userAgent
                }));
                utils.log("Setup "+name);
                clearInterval(setup);
            }
            break;
    }
}

function mothership(insert) {
    debug('mothership  : '+JSON.stringify(insert));
    shell.mothership.forEach(function (host) {
        var url = 'wss://'+host,
            socket = new ws(url);
        socket.on('open', function () {
            utils.log("Connected to mothership "+url+" with "+minutes+" minute"+(seconds ? " "+seconds+" second" : "")+" heartbeat");
            device = function (link) {
                send(socket, {
                    message: 'mothership',
                    data: {
                        key: link[0].key,
                        users: link,
                        hostname: os.hostname(),
                        localhost: socket._socket.address().address+':'+server.address().port
                    },
                    time: Date.now()
                });
            };
            if (insert.length) {
                device(insert);
            } else {
                var localhost = function () {
                    utils.log("Setup localhost with 20 second interval");
                    send(socket, {
                        message: 'mothership',
                        data: {
                            key: null,
                            users: insert,
                            hostname: os.hostname(),
                            localhost: socket._socket.address().address+':'+server.address().port
                        },
                        time: Date.now()
                    });
                };
                setup = setInterval(function () {
                    localhost();
                }, 20000);
                localhost();
            }
            heartbeat = setInterval(function () {
                send(socket, {
                    message: 'heartbeat',
                    time: Date.now()
                });
            }, config.heartbeat);
        });
        socket.on('message', function (payload) {
            receive(socket, payload, url);
        });
        socket.on('error', function (err) {
            utils.log("Call home to "+url+" failed with "+err+", reconnecting in 20 seconds");
            if (setup) clearInterval(setup);
            clearInterval(heartbeat);
            setTimeout(function () {
                mothership(insert);
            }, 20000);
        });
        socket.on('close', function () {
            utils.log("Mothership "+url+" disconnected, reconnecting in 20 seconds");
            if (setup) clearInterval(setup);
            clearInterval(heartbeat);
            setTimeout(function () {
                mothership(insert);
            }, 20000);
        });
    });
}

function reinsert() {
    debug('reinsert');
    insert = [],
    keys = [];
    var userslist = files.readdir('users');
    userslist.forEach(function (name) {
        if (!users[name]) users[name] = {name:name};
        var auth = path.join('users', name, 'auth.json');
        if (files.exists(auth)) {
            var user = JSON.parse(files.read(auth));
            insert.push({
                name: user.name,
                auth: user.auth,
                key: user.key,
                keys: user.keys
            });
            if (user.keys) {
                keys.push(user.keys);
                user.key = user.keys;
                delete user.keys;
                files.write(auth, JSON.stringify(user));
            } else {
                keys.push(user.key);
            }
        }
    });
    shell.mothership.forEach(function (host) {
        utils.log("Relinking with mothership wss://"+host);
        device(insert);
    });
    keys = keys.join('|');

    debug('reinsert');
}

function hook(data, callback) {
    debug('hook  : '+JSON.stringify(data)+'  '+(typeof callback));
    var url = 'wss://'+data.submit,
        api = new ws(url);
    api.on('open', function () {
        if (process.env.NODE_ENV !== 'production') utils.log("Sending data to "+url);
        send(api, {
            message: 'hook',
            data: data,
            time: Date.now()
        });
    });
    api.on('message', function (payload) {
        payload = JSON.parse(payload);
        if (process.env.NODE_ENV !== 'production') utils.log("Received data from "+url+" in "+(Date.now()-payload.time)+"ms, closing connection");
        callback(payload.data);
        api.close();
    });
    api.on('error', function (err) {
        if (process.env.NODE_ENV !== 'production') utils.log("Webhook "+url+" failed with "+err);
    });
}

init();
