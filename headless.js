/**
 * Headless.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, indent:4
*/

if (typeof process === 'undefined') {
    console.error("Headless daemon needs to be executed with node");
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
// TODO: http://nodejs.org/api/domain.html
process.on('uncaughtException', function (err) {
    "use strict";
    console.error("UncaughtException: "+err.stack);
});

// Globals
os = require('os'),
fs = require('fs'),
cp = require('child_process'),
path = require('path'),
http = require('http'),
https = require('https'),
util = require('util'),
url = require('url'),
querystring = require('querystring'),
file = new (require('node-static')).Server('./mothership'),
ws = require('ws'),
bcrypt = require('bcrypt'),
uuid = require('node-uuid'),
isbinaryfile = require('isbinaryfile');
beautify = require('js-beautify').js_beautify;

config = require('./config'),
utils = require('./modules/utils'),
files = require('./modules/node/files'),
container = require('./container'),
shell = JSON.parse(files.read(path.join('shell', 'config.json'))),
version = JSON.parse(files.read('package.json')).version,
error = null;

send = function (socket, data) {
    "use strict";
    if (socket) {
        socket.send(JSON.stringify(data), function (err) {
            if (err && err.message !== 'not opened' && process.env.NODE_ENV !== 'production') console.error(err.stack);
        });
    }
};

if (config.http) {
    http.createServer(function (req, res) {
        "use strict";
        req.addListener('end', function () {
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
    wss = null;

var init = function () {
    "use strict";
    server = https.createServer({
        key: files.read('headless-key.pem'),
        cert: files.read('headless-cert.pem')
    }, function (req, res) {
        req.addListener('end', function () {
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
                        load = req.post ? JSON.parse(req.post) : {};
                    utils.extend(load, querystring.parse(uri.query));
                    if (!load.remoteAddress) load.remoteAddress = req.socket.remoteAddress;
                    callbacks[callbackid] = function (out) {
                        var data = null;
                        if (!out.stream) {
                            if (out.type) {
                                data = out.data;
                            } else {
                                data = beautify(JSON.stringify(out.data));
                            }
                        }
                        if (!out.stream || out.stream === 'start') {
                            res.writeHead(200, {
                                'Content-Type': out.type ? out.type : 'application/json',
                                'Content-Length': out.size ? out.size : data.length
                            });
                        }
                        if (!out.stream) {
                            res.write(data);
                        } else if (out.stream === 'data') {
                            res.write(new Buffer(out.data, 'base64'));
                        }
                        if (!out.stream || out.stream === 'end') res.end();
                    };
                    send(users[name].host, {
                        id: callbackid,
                        message: 'endpoint',
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
                                            var load = req.post ? JSON.parse(req.post) : {};
                                            utils.extend(load, querystring.parse(uri.query));
                                            if (!load.remoteAddress) load.remoteAddress = req.socket.remoteAddress;
                                            if (process.env.NODE_ENV !== 'production') util.log("Endpoint requested "+uri.pathname+" > "+load.remoteAddress);
                                            var api = new container(list.list.container, users[name], list.path, i, load);
                                            api.callback = function (out) {
                                                var data = null;
                                                if (!out.stream) {
                                                    if (out.type) {
                                                        data = out.data;
                                                    } else {
                                                        data = beautify(JSON.stringify(out.data));
                                                    }
                                                }
                                                if (!out.stream || out.stream === 'start') {
                                                    res.writeHead(200, {
                                                        'Content-Type': out.type ? out.type : 'application/json',
                                                        'Content-Length': out.size ? out.size : data.length
                                                    });
                                                }
                                                if (!out.stream) {
                                                    res.write(data);
                                                } else if (out.stream === 'data') {
                                                    res.write(new Buffer(out.data, 'base64'));
                                                }
                                                if (!out.stream || out.stream === 'end') res.end();
                                            };
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
    }).listen(config.https, config.ip, function () {
        wss = new ws.Server({server:server});
        wss.on('connection', function (socket) {
            if (socket.upgradeReq.headers['user-agent']) {
                if (process.env.NODE_ENV !== 'production') util.log("Hello "+socket._socket.remoteAddress);
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
                                                if (process.env.NODE_ENV !== 'production') util.log("Hello "+socket._socket.remoteAddress+" > "+name);
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
                        case 'endpoint':
                            var match = /(.*)\.headless\.io/.exec(socket.upgradeReq.headers.host),
                                name = match && /\./.test(match[1]) ? match[1].split('.')[0] : match ? match[1] : null;
                            if (match && users[name] && users[name].host) {
                                if (!data.remoteAddress) data.remoteAddress = socket._socket.remoteAddress;
                                callbacks[callbackid] = function (out) {
                                    send(socket, {
                                        message: 'endpoint',
                                        data: out.data,
                                        time: payload.time
                                    });
                                };
                                send(users[name].host, {
                                    id: callbackid,
                                    message: 'endpoint',
                                    data: {
                                        submit: socket.upgradeReq.url.substring(1),
                                        payload: data
                                    },
                                    time: Date.now()
                                });
                                callbackid++;
                            } else {
                                if (isFinite(payload.id)) {
                                    callbacks[payload.id](data);
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
                                                            if (process.env.NODE_ENV !== 'production') util.log("Endpoint served "+socket.upgradeReq.url+" > "+data.remoteAddress);
                                                            var api = new container(list.list.container, users[name], list.path, i, data);
                                                            api.callback = function (out) {
                                                                if (out.data.message === 'data' && out.data.data.command === 'box' &&
                                                                    out.data.data.args.boxes[0].data &&
                                                                    out.data.data.args.boxes[0].data.insert
                                                                ) {
                                                                    var user = JSON.parse(files.read(path.join('users', out.data.name, 'auth.json')));
                                                                    users[out.data.name] = {name:out.data.name};
                                                                    keys = keys+'|'+user.key;
                                                                }
                                                                send(socket, {
                                                                    message: 'endpoint',
                                                                    data: out.data,
                                                                    time: payload.time
                                                                });
                                                            };
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
                            if (users[name] && users[name].socket) users[name].socket.terminate();
                        });
                    }
                });
            }
        });
        util.log("Headless daemon listening on https://"+server.address().address+":"+server.address().port);
    });

    var userslist = files.exists('users') ? files.readdir('users') : [];
    userslist.forEach(function (name) {
        users[name] = {name:name};
        var lists = path.join('users', name, 'lists');
        if (files.exists(lists)) {
            var listslist = files.lists(lists);
            listslist.forEach(function (list) {
                if (list.list.run) {
                    if (list.list.run.constructor === Number) {
                        var hours = (list.list.run/1000/60/60)<<0,
                            minutes = (list.list.run/1000/60)%60*60,
                            seconds = (list.list.run/1000)%60;
                        var loop = function () {
                            util.log("Running "+list.path+" with "+hours+" hour"+(minutes ? " "+minutes+" minute" : "")+(seconds ? " "+seconds+" second" : "")+" interval");
                            var run = new container(list.list.container, users[name], list.path, -1, null);
                        };
                        intervals.push(setInterval(loop, list.list.run));
                        loop();
                    } else {
                        util.log("Running "+list.path);
                        var run = new container(list.list.container, users[name], list.path, -1, null);
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
};

function receive(socket, payload, upstream) {
    "use strict";
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
                    if (!upstream) socket.user = user;
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
                                            if (/\.json$/.exec(val)) load[key] = beautify(load[key]);
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
                                                var log = "Installing shell "+list.shell;
                                                util.log(log);
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
                                                        util.log(log);
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
                                                        util.log(log);
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
                                users[name].containers.push(new container(data.container, users[name], data.list, data.index, null));
                                break;
                            case 'kill':
                                var contain = users[name].containers ? users[name].containers[users[name].containers.length-1] : null;
                                if (contain) contain.kill();
                                break;
                            case 'restart':
                                if (upstream) {
                                    socket.removeAllListeners('close');
                                    socket.terminate();
                                }
                                for (var user in users) {
                                    if (user.containers) {
                                        user.containers.forEach(function (contain) {
                                            if (contain) contain.kill();
                                        });
                                    }
                                }
                                if (config.restart) {
                                    util.log("Restarting with "+config.restart);
                                    cp.exec(config.restart);
                                } else {
                                    util.log("Forcing restart by quitting");
                                    process.exit();
                                }
                                break;
                            case 'pass':
                                var name = data.pass.name,
                                    auth = path.join('users', name, 'auth.json'),
                                    user = JSON.parse(files.read(auth));
                                util.log("Updating "+name+"'s password");
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
                                endpoint(data.api, function (out) {
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
        case 'endpoint':
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
                                    var url = upstream,
                                        callback = new ws(url);
                                    if (!data.payload.remoteAddress) data.payload.remoteAddress = socket._socket.remoteAddress;
                                    if (process.env.NODE_ENV !== 'production') util.log("Endpoint received from "+url+"/"+data.submit+" > "+data.payload.remoteAddress);
                                    callback.on('open', function () {
                                        if (process.env.NODE_ENV !== 'production') util.log("Sending data to callback "+url);
                                        var api = new container(list.list.container, users[name], list.path, i, data.payload);
                                        api.callback = function (out) {
                                            send(callback, {
                                                id: payload.id,
                                                message: 'endpoint',
                                                data: out,
                                                time: payload.time
                                            });
                                            if (!out.stream || out.stream === 'end') {
                                                if (process.env.NODE_ENV !== 'production') util.log("Send complete, closing connection");
                                                callback.terminate();
                                            }
                                        };
                                    });
                                    callback.on('error', function (err) {
                                        if (process.env.NODE_ENV !== 'production') util.log("Callback "+url+" failed with "+err);
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
            if (!upstream) {
                send(socket, {
                    message: 'heartbeat',
                    time: payload.time
                });
            } else {
                util.log("Heartbeat with "+(Date.now()-payload.time)+"ms latency");
            }
            break;
        case 'setup':
            if (!upstream) {
                if (!data) {
                    if (process.env.NODE_ENV !== 'production') util.log("Setup "+socket._socket.remoteAddress+" socket");
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
                util.log("Setup "+name);
                clearInterval(setup);
            }
            break;
    }
}

function mothership(insert) {
    "use strict";
    shell.mothership.forEach(function (host) {
        var url = 'wss://'+host,
            socket = new ws(url);
        socket.on('open', function () {
            util.log("Connected to mothership "+url+" with "+minutes+" minute"+(seconds ? " "+seconds+" second" : "")+" heartbeat");
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
                    util.log("Setup localhost with 20 second interval");
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
            util.log("Call home to "+url+" failed with "+err+", reconnecting in 20 seconds");
            clearInterval(heartbeat);
            setTimeout(function () {
                mothership(insert);
            }, 20000);
        });
        socket.on('close', function () {
            util.log("Mothership "+url+" disconnected, reconnecting in 20 seconds");
            clearInterval(heartbeat);
            setTimeout(function () {
                mothership(insert);
            }, 20000);
        });
    });
}

function reinsert() {
    "use strict";
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
        util.log("Relinking with mothership wss://"+host);
        device(insert);
    });
    keys = keys.join('|');
}

function endpoint(data, callback) {
    "use strict";
    var url = 'wss://'+data.submit,
        api = new ws(url);
    api.on('open', function () {
        if (process.env.NODE_ENV !== 'production') util.log("Sending data to endpoint "+url);
        send(api, {
            message: 'endpoint',
            data: data,
            time: Date.now()
        });
    });
    api.on('message', function (payload) {
        payload = JSON.parse(payload);
        if (process.env.NODE_ENV !== 'production') util.log("Received data from endpoint "+url+" in "+(Date.now()-payload.time)+"ms, closing connection");
        callback(payload.data);
        api.terminate();
    });
    api.on('error', function (err) {
        if (process.env.NODE_ENV !== 'production') util.log("Endpoint "+url+" failed with "+err);
    });
}

init();
