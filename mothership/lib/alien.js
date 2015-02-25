/**
 * Headless alien interface.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false,
 loopfunc:true, shadow:true, browser:true, indent:4
*/

function pad(n) {
    "use strict";
    return n < 10 ? '0'+n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
    "use strict";
    var d = new Date(),
        time = [
            pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds())
        ].join(':');
    return [d.getDate(), months[d.getMonth()], time].join(' ');
}

function toTimer(time) {
    "use strict";
    var h, m, s;
    h = Math.floor(time/3600);
    h = isNaN(h) ? '--' : h > 9 ? h : '0'+h;
    m = Math.floor(time/60%60);
    m = isNaN(m) ? '--' : m > 9 ? m : '0'+m;
    s = Math.floor(time%60);
    s = isNaN(s) ? '--' : s > 9 ? s : '0'+s;
    return h+':'+m+':'+s;
}

// TODO: Multiple probes
var d = document,
    page = 0,
    pages = [],
    alien = {},
    interfaces = {},
    list = false,
    infobox = null,
    infoboxes = [],
    error = null,
    marker = null,
    probes = [],
    memory = {},
    socket = null,
    audio = d.createElement('audio'),
    audioargs = null;

alien.probe = function (ghost, platform) {
    "use strict";
    this.platform = platform;
    this.separator = this.platform === 'win32' ? '\\' : '/';
    if (!ghost.view) ghost.view = {};
    this.ghost = ghost;
    this.lists = ghost.lists;
    delete ghost.lists;
    this.view = ghost.view;
    this.view.list = this.view.list !== undefined ? this.view.list : false;
    this.view.lists = this.view.lists !== undefined ? this.view.lists : false;
    this.view.files = this.view.files !== undefined ? this.view.files : false;
    this.view.users = this.view.users !== undefined ? this.view.users : false;
    this.view.log = this.view.log !== undefined ? this.view.log : false;
    this.memory = ghost.memory ? ghost.memory : {};
    this.files = ghost.files ? ghost.files : [];
    this.loading = true;
    this.command = function (name, value) {
        var obj = {};
        obj[name] = value;
        socket.send(JSON.stringify({
            message: 'request',
            data: obj,
            time: Date.now()
        }));
    };
    this.load = function (data) {
        this.loading = true;
        this.command('load', data);
    };
    this.save = function (data) {
        this.command('save', data);
    };
    this.move = function (data) {
        this.command('move', data);
    };
    this.merge = function (merge) {
        var obj = {};
        obj[this.join('users', user.input.value, 'config.json')] = this.ghost;
        if (list !== false) {
            var items = [];
            listeditor.editor.eachLine(function (line) {
                if (line) {
                    var text = line.text;
                    if (memory[text] && memory[text].item) items.push(memory[text].item);
                }
            });
            if (JSON.stringify(items) !== JSON.stringify(this.lists[list].list.items)) {
                this.lists[list].list.items = JSON.parse(JSON.stringify(items));
                obj[this.lists[list].path] = this.lists[list].list;
            }
        }
        list = this.view.list;
        if (!merge) this.save(obj);
        return obj;
    };
    this.hash = function (data) {
        socket.send(JSON.stringify({
            message: 'request',
            data: {
                save: data,
                hash: true
            },
            time: Date.now()
        }));
    };
    this.run = function (index) {
        socket.send(JSON.stringify({
            message: 'request',
            data: {
                save: this.merge(true),
                container: this.lists[this.view.list].list.container,
                list: this.lists[this.view.list].path,
                index: index !== undefined ? typeof index === "string" ? listeditor.line(index) : index : -1
            },
            time: Date.now()
        }));
        if (!probes[0].view.log) log.element.onclick();
    };
    this.kill = function () {
        this.command('kill', '');
    };
    this.restart = function () {
        this.command('restart', '');
    };
    this.pass = function (data) {
        this.command('pass', data);
    };
    this.api = function (data) {
        this.command('api', data);
    };
    this.pullout = function () {
        if (!this.loading && error && typeof error === "object") {
            if (!error.text) {
                for (var i = 0; i < this.files.length; i++) {
                    var pattern = new RegExp((this.files[i].path+this.separator).replace('.'+this.separator, ''));
                    if (pattern.test(error.path)) {
                        error.text = error.path.replace(pattern, '');
                        if (this.view.files !== i) {
                            filesgroup.objects[i].element.onclick();
                        } else {
                            var pos = fileslist.line(error.text);
                            fileslist.lineChange(pos);
                            var editor = fileslist.editor;
                            editor.operation(function () {
                                editor.addLineClass(pos, 'background', 'error');
                                editor.scrollIntoView({line:pos}, 200);
                                editor.setCursor(pos, 0);
                            });
                        }
                        break;
                    }
                }
                if (!error.text) {
                    console.log("Error with no match to show: "+JSON.stringify(error));
                    error = null;
                }
            }
        }
    };
    this.join = function () {
        return Array.prototype.join.call(arguments, this.separator);
    };
};

alien.hash = function (ghost, platform) {
    "use strict";
    probes[0] = new alien.probe(ghost, platform);
    if (listgroup.objects.length) {
        for (var j = 0; j < listgroup.objects.length; j++) listgroup.objects[j].element.parentNode.removeChild(listgroup.objects[j].element);
        listgroup.objects = [];
    }
    if (filesgroup.objects.length) {
        for (var j = 0; j < filesgroup.objects.length; j++) filesgroup.objects[j].element.parentNode.removeChild(filesgroup.objects[j].element);
        filesgroup.objects = [];
    }
    for (var i = 0; i < probes[0].lists.length; i++) {
        var button = alien.button(probes[0].lists[i].list.name);
        button.element.style.left = (i ? listgroup.objects[i-1].element.offsetLeft+listgroup.objects[i-1].element.offsetWidth+10 : 0)+'px';
        button.element.className = 'btn'+(i === probes[0].view.list ? ' pressed' : '')+' small';
        button.element.setAttribute('data-list', i);
        button.element.onclick = function () {
            if (this.className !== 'btn pressed small') {
                for (var j = 0; j < listgroup.objects.length; j++) listgroup.objects[j].element.className = 'btn small';
                this.className = 'btn pressed small';
                lists.element.className = 'btn small';
                for (var j = 0; j < filesgroup.objects.length; j++) filesgroup.objects[j].element.className = 'btn small';
                mothership.element.className = 'btn small';
                run.element.className = 'btn small';
                run.element.setAttribute('data-visible', 'hidden');
                save.element.setAttribute('data-visible', 'hidden');
                restart.element.setAttribute('data-visible', 'hidden');
                run.hide();
                save.hide();
                restart.hide();
                listsbox.hide();
                filesbox.hide();
                usersbox.hide();
                probes[0].view.list = parseInt(this.getAttribute('data-list'), 10);
                probes[0].view.lists = false;
                probes[0].view.files = false;
                probes[0].view.users = false;
                probes[0].merge();
                fileslist.clearError();
                listeditor.editor.setValue('');
                listgutter.inner.innerHTML = '';
                listbox.resize();
                listsbox.resize();
                filesbox.resize();
                usersbox.resize();
                logbox.resize();
                actionbox.resize();
                if (infobox) infobox.resize();
                listbox.show();
                listeditor.load(probes[0].view.list);
            } else {
                this.className = 'btn small';
                run.element.setAttribute('data-visible', 'hidden');
                run.hide();
                run.element.className = 'btn small';
                listbox.hide();
                probes[0].view.list = false;
                probes[0].view.lists = false;
                probes[0].view.files = false;
                probes[0].view.users = false;
                probes[0].merge();
                listbox.resize();
                listsbox.resize();
                filesbox.resize();
                usersbox.resize();
                logbox.resize();
                actionbox.resize();
                if (infobox) infobox.resize();
            }
        };
        listgroup.addObject(button);
    }
    lists.element.className = 'btn'+(probes[0].view.lists ? ' pressed' : '')+' small';
    for (var i = 0; i < probes[0].files.length; i++) {
        var button = alien.button(probes[0].files[i].name);
        button.element.style.left = (i ? filesgroup.objects[i-1].element.offsetLeft+filesgroup.objects[i-1].element.offsetWidth+10 : 0)+'px';
        button.element.className = 'btn'+(i === probes[0].view.files ? ' pressed' : '')+' small';
        button.element.setAttribute('data-files', i);
        button.element.onclick = function () {
            if (this.className !== 'btn pressed small') {
                for (var j = 0; j < filesgroup.objects.length; j++) filesgroup.objects[j].element.className = 'btn small';
                this.className = 'btn pressed small';
                for (var j = 0; j < listgroup.objects.length; j++) listgroup.objects[j].element.className = 'btn small';
                lists.element.className = 'btn small';
                mothership.element.className = 'btn small';
                run.element.setAttribute('data-visible', 'hidden');
                save.element.setAttribute('data-visible', 'hidden');
                restart.element.setAttribute('data-visible', 'hidden');
                run.hide();
                save.hide();
                restart.hide();
                listbox.hide();
                listsbox.hide();
                usersbox.hide();
                probes[0].view.list = false;
                probes[0].view.lists = false;
                probes[0].view.files = parseInt(this.getAttribute('data-files'), 10);
                probes[0].view.users = false;
                probes[0].merge();
                fileslist.clearError();
                fileslist.editor.setValue('');
                fileseditor.editor.setValue('');
                listbox.resize();
                listsbox.resize();
                filesbox.resize();
                usersbox.resize();
                logbox.resize();
                actionbox.resize();
                if (infobox) infobox.resize();
                filesbox.show();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                probes[0].load({fileslist:probes[0].files[probes[0].view.files].path});
            } else {
                this.className = 'btn small';
                save.element.setAttribute('data-visible', 'hidden');
                restart.element.setAttribute('data-visible', 'hidden');
                save.hide();
                restart.hide();
                filesbox.hide();
                probes[0].view.list = false;
                probes[0].view.lists = false;
                probes[0].view.files = false;
                probes[0].view.users = false;
                probes[0].merge();
                fileslist.clearError();
                listbox.resize();
                listsbox.resize();
                filesbox.resize();
                usersbox.resize();
                logbox.resize();
                actionbox.resize();
                if (infobox) infobox.resize();
            }
        };
        filesgroup.addObject(button);
    }
    log.element.className = 'btn'+(probes[0].view.log ? ' pressed' : '')+' small';
    mothership.element.className = 'btn'+(probes[0].view.users ? ' pressed' : '')+' small';
    actionbox.element.setAttribute('data-visible', 'hidden');
};

alien.mothership = function () {
    "use strict";
    socket = new WebSocket('wss://'+location.host);
    socket.onopen = function (event) {
        console.log("Connected to mothership with 4 minute heartbeat");
        setInterval(function () {
            socket.send(JSON.stringify({
                message: 'heartbeat',
                time: Date.now()
            }));
        }, 240000);
    };
    socket.onmessage = function (event) {
        if (typeof event.data === 'string') {
            var payload = JSON.parse(event.data),
                message = payload.message,
                data = payload.data;
            switch (message) {
            case 'response':
                if (data.auth && data.ghost) {
                    loader.hide();
                    console.log("Authorized in "+(Date.now()-payload.time)+"ms with localhost of "+data.localhost);
                    probename.element.innerHTML = data.hostname;
                    var ghost = data.ghost;
                    ghost.lists = data.lists;
                    alien.hash(ghost, data.platform);
                    for (var x in pages[page]) pages[page][x].hide();
                    page++;
                    for (var x in pages[page]) {
                        var object = pages[page][x];
                        object.resize();
                        switch (x) {
                        case 'listgroup':
                            object.show();
                            if (probes[0].view.list !== false && probes[0].lists[probes[0].view.list]) {
                                listbox.show();
                                listeditor.load(probes[0].view.list);
                            }
                            break;
                        case 'listbox':
                            break;
                        case 'lists':
                            object.show();
                            if (probes[0].view.lists) {
                                listsbox.show();
                                loader.resize = function () {
                                    this.element.style.left = '10px';
                                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                                };
                                loader.show();
                                probes[0].load({listslist:probes[0].join('users', user.input.value, 'lists')});
                            }
                            break;
                        case 'listsbox':
                            break;
                        case 'filesgroup':
                            object.show();
                            if (probes[0].view.files !== false && probes[0].files[probes[0].view.files]) {
                                filesbox.show();
                                loader.resize = function () {
                                    this.element.style.left = '10px';
                                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                                };
                                loader.show();
                                probes[0].load({fileslist:probes[0].files[probes[0].view.files].path});
                            }
                            break;
                        case 'filesbox':
                            break;
                        case 'log':
                            object.show();
                            if (probes[0].view.log) {
                                listeditor.editor.setOption('lineNumbers', true);
                                logbox.show();
                            }
                            break;
                        case 'logbox':
                            break;
                        case 'mothership':
                            object.show();
                            if (probes[0].view.users) {
                                usersbox.show();
                                loader.resize = function () {
                                    this.element.style.left = '10px';
                                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                                };
                                loader.show();
                                probes[0].load({userslist:'users'});
                            }
                            break;
                        case 'usersbox':
                            break;
                        default:
                            object.show();
                        }
                    }
                    if (probes[0].view.list === false && !probes[0].view.lists && probes[0].view.files === false && !probes[0].view.users)
                        probes[0].loading = false;
                } else {
                    loader.hide();
                    probe.element.className = 'btn';
                    user.input.value = '';
                    pass.input.value = '';
                    user.input.focus();
                    if (data.auth && !data.ghost) {
                        noghost.resize = function () {
                            this.element.style.left = form.element.offsetLeft+'px';
                            this.element.style.top = form.element.offsetTop+form.element.offsetHeight+4+'px';
                        };
                        noghost.resize();
                        noghost.show();
                    }
                }
                break;
            case 'data':
                if (data.load) {
                    loader.hide();
                    for (var x in data.load) {
                        window[x].load(data.load[x]);
                        if (probes[0].view.files !== false) {
                            if (error && typeof error === "object") {
                                if (x === 'fileslist') {
                                    var pos = fileslist.line(error.text),
                                        editor = fileslist.editor;
                                    editor.operation(function () {
                                        editor.addLineClass(pos, 'background', 'error');
                                        editor.scrollIntoView({line:pos}, 200);
                                        editor.setCursor(pos, 0);
                                    });
                                    fileslist.lineChange(pos);
                                } else if (x === 'fileseditor') {
                                    var makeMarker = function () {
                                        var marker = d.createElement('div');
                                        marker.style.color = '#822';
                                        marker.innerHTML = '●';
                                        return marker;
                                    };
                                    var editor = fileseditor.editor;
                                    editor.operation(function () {
                                        editor.clearGutter('breakpoints');
                                        if (marker) marker.clear();
                                        editor.setGutterMarker(error.line, 'breakpoints', makeMarker());
                                        marker = editor.markText({line:error.line, ch:error.ch}, {line:error.line, ch:error.ch+1}, {className:'CodeMirror-headless-mark-error'});
                                        editor.scrollIntoView({line:error.line}, 200);
                                        editor.setCursor(error.line, error.ch);
                                        editor.focus();
                                    });
                                    errmsg.element.innerHTML = error.message;
                                    errmsg.show();
                                    error = null;
                                }
                            } else if (probes[0].files[probes[0].view.files].memory) {
                                if (x === 'fileslist') {
                                    var filesmemory = probes[0].files[probes[0].view.files].memory.fileslist,
                                        editor = fileslist.editor,
                                        pos = filesmemory.line;
                                    editor.operation(function () {
                                        editor.scrollTo(filesmemory.left, filesmemory.top);
                                        editor.setCursor(filesmemory.line, filesmemory.ch);
                                    });
                                    fileslist.lineChange(pos);
                                } else if (x === 'fileseditor') {
                                    var filesmemory = probes[0].files[probes[0].view.files].memory.fileseditor,
                                        editor = fileseditor.editor,
                                        pos = fileslist.editor.getCursor().line;
                                    // TODO: Investigate CodeMirror's buggy scroll position
                                    if (pos !== filesmemory.pos) {
                                        editor.operation(function () {
                                            editor.refresh();
                                            editor.scrollTo(0, 0);
                                            editor.setCursor(0, 0);
                                        });
                                        probes[0].files[probes[0].view.files].memory.fileseditor = {
                                            pos: pos,
                                            left: 0,
                                            top: 0,
                                            line: 0,
                                            ch: 0
                                        };
                                    } else {
                                        editor.operation(function () {
                                            editor.scrollTo(filesmemory.left, filesmemory.top);
                                            editor.setCursor(filesmemory.line, filesmemory.ch);
                                        });
                                    }
                                }
                            }
                        }
                    }
                } else if (data.command === 'box') {
                    console.log(data.args);
                    if (data.args.id) {
                        var box = window[data.args.id].box;
                        box.element.innerHTML = '';
                        box = alien.box(data.args.boxes[0], 0, data.args.id);
                        box.show();
                        window[data.args.id].box = box;
                    } else {
                        var boxes = [];
                        for (var i = 0; i < data.args.boxes.length; i++) {
                            var box = alien.box(data.args.boxes[i], i);
                            box.element.style.top = (i ? boxes[i-1].element.offsetTop+boxes[i-1].element.offsetHeight+10 : 4)+'px';
                            boxes.push(box);
                        }
                        var group = alien.group(boxes);
                        group.element.setAttribute('data-visible', 'hidden');
                        group.element.className = 'infobox';
                        group.element.style.left = '10px';
                        group.element.style.top = '50px';
                        group.resize = function () {
                            this.element.style.width = (
                                probes[0].view.log && logbox.element.offsetLeft > 10 ? logbox.element.offsetLeft : d.documentElement.offsetWidth
                            )-20+'px';
                            this.element.style.height = logbox.element.offsetHeight+'px';
                            for (var i = 0; i < this.objects.length; i++) this.objects[i].resize();
                        };
                        group.boxes = boxes;
                        group.data = data.args;
                        group.resize();
                        infoboxes.push(group);
                        if (infoboxes.length === 1) {
                            infobox = infoboxes[0];
                            infobox.element.setAttribute('data-visible', 'visible');
                            infobox.show();
                        }
                    }
                // TODO: Video playback
                } else if (data.command === 'audio') {
                    console.log(data.args);
                    audio.pause();
                    if (audioargs) {
                        audioargs.progress = null;
                        audioargs.status = null;
                        listgutter.updateItem(audioargs);
                    } else {
                        audio.ontimeupdate = function () {
                            audioargs.progress = isFinite(audio.duration) ? Math.round((audio.currentTime/audio.duration)*100) : null;
                            audioargs.status = toTimer(audio.currentTime);
                            listgutter.updateItem(audioargs);
                        };
                    }
                    audioargs = data.args;
                    audio.src = /http:/.test(audioargs.src) ? audioargs.src : '/stream?src='+encodeURIComponent(audioargs.src);
                    audio.type = audioargs.type;
                    audio.play();
                    memory[audioargs.text].status.onclick = function () {
                        if (!audio.paused) {
                            audio.pause();
                        } else {
                            audio.play();
                        }
                    };
                    memory[audioargs.text].status.group.element.onclick = memory[audioargs.text].status.onclick;
                } else {
                    var pre = d.createElement('pre');
                    pre.innerHTML = timestamp()+' - '+(data.args.text ? data.args.text+' → ' : '')+data.args.message;
                    logbox.element.appendChild(pre);
                    if (!logbox.element.scrollTop ||
                        logbox.element.scrollHeight-(logbox.element.scrollTop+logbox.element.clientHeight) < 200
                    ) logbox.element.scrollTop = logbox.element.scrollHeight;
                    if (data.args.text) {
                        listgutter.updateItem(data.args);
                    } else if (data.args.progress === 100) {
                        for (var i = 0; i < listgutter.items.length; i++) {
                            var status = listgutter.items[i];
                            status.loader.element.setAttribute('data-visible', 'hidden');
                            status.loader.hide();
                        }
                        run.element.className = 'btn small';
                        if (probes[0].view.list !== false) {
                            listeditor.editor.focus();
                        }
                    } else if (data.args.loading === false) {
                        loader.hide();
                        if (probes[0].view.list !== false) {
                            listeditor.editor.focus();
                        } else if (probes[0].view.lists) {
                            var text = listslist.editor.getLine(listslist.editor.getCursor().line);
                            if (text !== '') {
                                save.element.setAttribute('data-visible', 'visible');
                                actionbox.resize();
                                save.show();
                            }
                            listslist.editor.focus();
                        } else if (probes[0].view.files !== false) {
                            var text = fileslist.editor.getLine(fileslist.editor.getCursor().line),
                                content = fileseditor.editor.getValue();
                            if (text !== '' && content !== 'binary') {
                                save.element.setAttribute('data-visible', 'visible');
                                actionbox.resize();
                                save.show();
                            }
                            if (error && typeof error === "object") {
                                fileseditor.editor.focus();
                            } else {
                                fileslist.editor.focus();
                            }
                        } else if (probes[0].view.users) {
                            var text = userslist.editor.getLine(userslist.editor.getCursor().line);
                            if (text !== '') {
                                save.element.setAttribute('data-visible', 'visible');
                                actionbox.resize();
                                save.show();
                                for (var x in userseditor.box)
                                    if (userseditor.box[x] && userseditor.box[x].input) userseditor.box[x].input.value = '';
                            }
                            userslist.editor.focus();
                        }
                    }
                }
                break;
            case 'hash':
                loader.hide();
                var ghost = data.ghost;
                ghost.lists = data.lists;
                alien.hash(ghost);
                resize();
                break;
            case 'error':
                error = data;
                probes[0].pullout();
                break;
            case 'heartbeat':
                console.log("Heartbeat with "+(Date.now()-payload.time)+"ms latency");
                break;
            }
        }
    };
    socket.onerror = socket.onclose = function () {
        location.reload();
    };
};
alien.mothership();

alien.element = function (element, node) {
    "use strict";
    node = node || d.body;
    element.style.visibility = 'hidden';
    element.style.position = 'absolute';
    element.style.WebkitTransform = 'translateZ(0)';
    element.style.MozTransform = 'translateZ(0)';
    element.style.msTransform = 'translateZ(0)';
    element.style.OTransform = 'translateZ(0)';
    element.style.transform = 'translateZ(0)';
    element.draggable = false;
    node.appendChild(element);
    this.element = element;
    this.show = function () {
        if (element.getAttribute('data-visible') !== 'hidden') element.style.visibility = 'visible';
    };
    this.hide = function () {
        element.style.visibility = 'hidden';
    };
};

alien.group = function (objects, node) {
    "use strict";
    this.objects = objects || [];
    var element = d.createElement('div');
    for (var i = 0; i < this.objects.length; i++) element.appendChild(this.objects[i].element);
    var object = new alien.element(element, node);
    object.addObject = function (obj) {
        this.objects.push(obj);
        var last = element.appendChild(obj.element);
        element.style.width = last.offsetLeft+last.offsetWidth+'px';
        element.style.height = last.offsetTop+last.offsetHeight+'px';
        return last;
    };
    object.show = function () {
        if (element.getAttribute('data-visible') !== 'hidden') {
            element.style.visibility = 'visible';
            for (var i = 0; i < this.objects.length; i++) this.objects[i].show();
        }
    };
    object.hide = function () {
        element.style.visibility = 'hidden';
        for (var i = 0; i < this.objects.length; i++) this.objects[i].hide();
    };
    object.bounds = function () {
        var width = 0,
            height = 0;
        for (var i = 0; i < this.objects.length; i++) {
            var elm = this.objects[i].element,
                boundswidth = elm.offsetLeft+elm.offsetWidth,
                boundsheight = elm.offsetTop+elm.offsetHeight;
            if (boundswidth > width) width = boundswidth;
            if (boundsheight > height) height = boundsheight;
        }
        element.style.width = width+'px';
        element.style.height = height+'px';
    };
    object.resize = function () {
        for (var i = 0; i < this.objects.length; i++) if (this.objects[i].resize) this.objects[i].resize();
    };
    object.objects = this.objects;
    if (object.objects.length) object.bounds();
    return object;
};

alien.loader = function () {
    "use strict";
    var element = d.createElement('div');
    element.style.left = '-9999px';
    element.style.width = '16px';
    element.style.height = '16px';
    var object = new alien.element(element);
    object.show = function () {
        if (element.getAttribute('data-visible') !== 'hidden') {
            if (object.resize) object.resize();
            element.className = 'loader';
            element.style.visibility = 'visible';
        }
    };
    object.hide = function () {
        element.style.visibility = 'hidden';
        element.style.left = '-9999px';
        element.style.top = '0px';
        element.className = '';
        delete object.resize;
    };
    return object;
};

alien.welcome = function (text) {
    "use strict";
    text = text || '';
    var element = d.createElement('div');
    element.className = 'we-come-in-peace';
    var t = d.createTextNode(text);
    element.appendChild(t);
    var object = new alien.element(element);
    return object;
};

alien.button = function (text, large) {
    "use strict";
    var element = d.createElement('a');
    element.className = 'btn'+(!large ? ' small' : '');
    var t = d.createTextNode(text);
    element.appendChild(t);
    var object = new alien.element(element);
    return object;
};

alien.input = function (text, password, maxlength) {
    "use strict";
    var element = d.createElement('form');
    var input = d.createElement('input');
    input.type = !password ? 'text' : 'password';
    input.maxLength = maxlength || 255;
    input.placeholder = text;
    input.autocapitalize = 'none';
    element.appendChild(input);
    var object = new alien.element(element);
    object.input = input;
    return object;
};

alien.legal = function () {
    "use strict";
    var element = d.createElement('div');
    element.className = 'legal';
    var div = d.createElement('div');
    div.innerHTML = '<a href="https://twitter.com/HeadlessIO" target="_blank">@HeadlessIO</a>';
    element.appendChild(div);
    div = d.createElement('div');
    div.innerHTML = 'TM & &copy; UFO Technologies Ltd.';
    element.appendChild(div);
    div = d.createElement('div');
    div.innerHTML = '<a href="http://blog.ufotechnologies.com/" target="_blank">Made with &#10084; in Toronto, Canada</a>';
    element.appendChild(div);
    var object = new alien.element(element);
    return object;
};

alien.github = function () {
    "use strict";
    var element = d.createElement('a');
    element.href = 'https://github.com/pschroen/headless';
    element.target = '_blank';
    var forkme = d.createElement('img');
    forkme.src = 'https://s3.amazonaws.com/github/ribbons/forkme_left_white_ffffff.png';
    forkme.alt = 'Fork me on GitHub';
    element.appendChild(forkme);
    var object = new alien.element(element);
    return object;
};

alien.probename = function () {
    "use strict";
    var element = d.createElement('a');
    element.className = 'probename';
    var object = new alien.element(element);
    return object;
};

alien.listeditor = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'listeditor';
    var object = new alien.element(element);
    object.pos = null;
    object.lineCount = null;
    var editor = CodeMirror(element, {
        theme: 'headless',
        mode: '',
        styleActiveLine: true,
        lineWrapping: true,
        showCursorWhenSelecting: true
    });
    editor.on('scroll', function () {
        listgutter.inner.style.top = '-'+editor.getScrollInfo().top+'px';
    });
    editor.on('keyHandled', function (editor, name, e) {
        console.log(name+','+editor.getCursor().line);
        if (name === 'Enter') {
            var pos = editor.getCursor().line,
                text = editor.getLine(pos-1);
            if (text !== '') {
                pos = pos-1;
                editor.operation(function () {
                    editor.replaceRange(text.toLowerCase(), {line:pos, ch:0}, {line:pos+1, ch:0});
                    editor.setCursor(pos, 0);
                });
                text = editor.getLine(pos);
                run.element.className = 'btn pressed small';
                memory[text] = {item:{text:text}};
                listgutter.addItem(text, memory[text].item);
                listgutter.index();
                object.lineChange(pos);
                probes[0].run(text);
            }
            if (editor.lineCount() !== object.lineCount) listgutter.index();
        } else if (name === 'Down' || name === 'Up' || name === 'Right' || name === 'Left') {
            var pos = editor.getCursor().line;
            if (pos !== object.pos) {
                if (!editor.somethingSelected()) {
                    object.lineChange(pos);
                } else if (editor.getSelection('|').split('|').length > 2) {
                    object.clear();
                    object.pos = pos;
                }
            }
        }
    });
    editor.on('mousedown', function (editor, e) {
        var pos = editor.coordsChar({left:e.pageX, top:e.pageY}).line;
        if (pos !== object.pos) {
            if (!editor.somethingSelected()) {
                object.lineChange(pos);
            } else if (editor.getSelection('|').split('|').length > 2) {
                object.clear();
                object.pos = pos;
            }
        }
    });
    editor.on('change', function (editor, change) {
        if (change.origin && change.origin !== 'setValue' && change.origin !== '+input') {
            if (change.removed.length > 1) {
                for (var i = 0; i < change.removed.length; i++) {
                    var text = change.removed[i];
                    if (memory[text] && memory[text].status) {
                        var group = memory[text].status.group;
                        group.element.parentNode.removeChild(group.element);
                    }
                }
                probes[0].merge();
            }
            if (!(change.origin === 'paste' && change.text.length === 1)) object.lineChange(editor.getCursor().line);
            listgutter.index();
        }
    });
    object.editor = editor;
    object.line = function (text) {
        var offset = 0,
            pos = null;
        editor.eachLine(function (line) {
            if (line.text === text) pos = editor.getLineNumber(line)-offset;
            if (line.text === '') offset++;
        });
        return pos;
    };
    object.lineChange = function (pos) {
        this.clear();
        var text = editor.getLine(pos);
        if (text !== '' || editor.lineCount() > 2) {
            run.element.setAttribute('data-visible', 'visible');
            actionbox.resize();
            run.show();
        }
        this.pos = pos;
    };
    object.load = function (i) {
        this.pos = null;
        this.lineCount = null;
        listgutter.inner.innerHTML = '';
        listgutter.items = [];
        var content = [];
        for (var j = 0; j < probes[0].lists[i].list.items.length; j++) {
            var item = probes[0].lists[i].list.items[j];
            content.push(item.text);
        }
        editor.operation(function () {
            editor.setValue([''].concat(content).join('\n')+'\n');
            if (probes[0].view.list !== false) {
                var text = editor.getLine(editor.getCursor().line);
                if (text !== '' || editor.lineCount() > 2) {
                    run.element.setAttribute('data-visible', 'visible');
                    actionbox.resize();
                    run.show();
                }
                editor.focus();
                for (var j = 0; j < probes[0].lists[i].list.items.length; j++) {
                    var item = probes[0].lists[i].list.items[j];
                    listgutter.addItem(item.text, item);
                }
                listgutter.index();
            }
            list = i;
            probes[0].loading = false;
            editor.clearHistory();
        });
    };
    object.clear = function () {
        run.element.setAttribute('data-visible', 'hidden');
        run.hide();
        run.element.className = 'btn small';
    };
    return object;
};

alien.listgutter = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'listgutter';
    var inner = d.createElement('div');
    element.appendChild(inner);
    var object = new alien.element(element);
    object.inner = inner;
    object.items = [];
    object.addItem = function (text, item) {
        var status = memory[text] && memory[text].status ? memory[text].status : {
            loader: alien.loader(),
            progress: alien.progress(),
            type: alien.type()
        };
        status.group = alien.group([status.loader, status.progress, status.type], this.inner);
        if (status.onclick) status.group.element.onclick = status.onclick;
        this.items.push(status);
        if (!(memory[text] && memory[text].status)) {
            memory[text] = {
                status: status,
                item: JSON.parse(JSON.stringify(item))
            };
            status.loader.element.setAttribute('data-visible', 'hidden');
            status.progress.element.style.left = '26px';
            status.progress.element.setAttribute('data-visible', 'hidden');
            status.type.element.style.left = '26px';
            status.type.element.setAttribute('data-visible', 'hidden');
        }
    };
    object.updateItem = function (data) {
        var text = data.text;
        if (memory[text] && memory[text].status) {
            var status = memory[text].status;
            if (data.loading) {
                status.loader.element.style.left = '0px';
                status.loader.element.style.top = '1px';
                status.loader.element.setAttribute('data-visible', 'data');
                if (probes[0].view.list !== false && !infobox) status.loader.show();
            } else {
                status.loader.element.setAttribute('data-visible', 'hidden');
                status.loader.hide();
            }
            if (!(data.progress === null || data.progress === 100)) {
                status.type.element.style.left = '132px';
                status.progress.setPercent(data.progress);
                status.progress.element.setAttribute('data-visible', 'data');
                if (data.progress === 0) status.type.element.className = 'type';
                if (probes[0].view.list !== false && !infobox) status.progress.show();
            } else {
                status.progress.element.setAttribute('data-visible', 'hidden');
                status.progress.hide();
                status.type.element.style.left = '26px';
                if (data.progress === 100) status.type.element.className = 'type done';
            }
            if (data.status) {
                status.type.setStatus(data.status);
                status.type.element.setAttribute('data-visible', 'data');
                if (probes[0].view.list !== false && !infobox) status.type.show();
            } else {
                status.type.element.setAttribute('data-visible', 'hidden');
                status.type.hide();
            }
        }
    };
    object.index = function () {
        var pos = 0;
        listeditor.editor.eachLine(function (line) {
            var text = line.text;
            if (memory[text] && memory[text].status) {
                var group = memory[text].status.group,
                    textHeight = listeditor.editor.defaultTextHeight();
                group.element.style.top = pos*textHeight+'px';
                group.show();
            }
            pos++;
        });
        listeditor.lineCount = listeditor.editor.lineCount();
    };
    object.show = function () {
        if (this.element.getAttribute('data-visible') !== 'hidden') {
            this.element.style.visibility = 'visible';
            this.inner.style.visibility = 'visible';
            for (var i = 0; i < this.items.length; i++) {
                var item = this.items[i];
                for (var x in item) if (item[x] && item[x].element) item[x].show();
            }
        }
    };
    object.hide = function () {
        this.element.style.visibility = 'hidden';
        this.inner.style.visibility = 'hidden';
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            for (var x in item) if (item[x] && item[x].element) item[x].hide();
        }
    };
    return object;
};

alien.progress = function () {
    "use strict";
    var element = d.createElement('a');
    element.style.width = '100px';
    element.style.height = '18px';
    var progress = d.createElement('div');
    progress.className = 'progress';
    progress.draggable = false;
    progress.style.left = '0px';
    progress.style.top = '5px';
    progress.style.clip = 'rect(0px, 100px, 18px, 0px)';
    element.appendChild(progress);
    var percent = d.createElement('div');
    percent.className = 'percent';
    percent.draggable = false;
    percent.style.left = '0px';
    percent.style.top = '5px';
    percent.style.clip = 'rect(0px, 0px, 18px, 0px)';
    element.appendChild(percent);
    var object = new alien.element(element);
    object.setPercent = function (n) {
        progress.style.clip = 'rect(0px, 100px, 18px, '+n+'px)';
        percent.style.clip = 'rect(0px, '+n+'px, 18px, 0px)';
    };
    return object;
};

alien.type = function (text) {
    "use strict";
    text = text || '';
    var element = d.createElement('a');
    element.className = 'type';
    element.appendChild(d.createTextNode(text));
    var object = new alien.element(element);
    element.style.top = '1px';
    object.setStatus = function (t) {
        element.innerHTML = t;
    };
    return object;
};

alien.listslist = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'listslist';
    var object = new alien.element(element);
    object.items = [];
    object.pos = null;
    object.lineCount = null;
    var editor = CodeMirror(element, {
        theme: 'headless',
        mode: '',
        styleActiveLine: true,
        lineWrapping: true,
        showCursorWhenSelecting: true
    });
    editor.on('keyHandled', function (editor, name, e) {
        console.log(name+','+editor.getCursor().line);
        if (name === 'Enter') {
            var pos = editor.getCursor().line,
                text = editor.getLine(pos-1);
            if (text !== '') {
                pos = pos-1;
                editor.operation(function () {
                    editor.replaceRange(text.toLowerCase(), {line:pos, ch:0}, {line:pos+1, ch:0});
                    editor.setCursor(pos, 0);
                });
                text = editor.getLine(pos);
                var path = probes[0].join('users', user.input.value, 'lists', text+'.json');
                save.element.setAttribute('data-visible', 'hidden');
                save.hide();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                var obj = {};
                if (object.items[pos] && object.items[pos] !== '' && object.items[pos] !== path) {
                    obj[object.items[pos]] = path;
                    obj[path] = listseditor.data;
                    probes[0].move(obj);
                    object.items[pos] = path;
                } else {
                    obj[path] = listseditor.data ? listseditor.data : {
                        name: text,
                        container: 'node',
                        shell: 'script',
                        items: []
                    };
                    probes[0].save(obj);
                    object.items[pos] = path;
                }
                object.lineChange(pos);
            }
            if (editor.lineCount() !== object.lineCount) object.index();
        } else if (name === 'Down' || name === 'Up' || name === 'Right' || name === 'Left') {
            var pos = editor.getCursor().line;
            if (pos !== object.pos) {
                if (!editor.somethingSelected()) {
                    object.lineChange(pos);
                } else if (editor.getSelection('|').split('|').length > 2) {
                    object.clear();
                    object.pos = pos;
                }
            }
        }
    });
    editor.on('mousedown', function (editor, e) {
        var pos = editor.coordsChar({left:e.pageX, top:e.pageY}).line;
        if (pos !== object.pos) {
            if (!editor.somethingSelected()) {
                object.lineChange(pos);
            } else if (editor.getSelection('|').split('|').length > 2) {
                object.clear();
                object.pos = pos;
            }
        }
    });
    editor.on('change', function (editor, change) {
        if (change.origin && change.origin !== 'setValue' && change.origin !== '+input') {
            if (change.removed.length > 1) {
                var obj = {},
                    pos = change.from.line;
                for (var i = pos; i < pos+change.removed.length-1; i++) {
                    if (object.items[pos]) {
                        obj[object.items[pos]] = '';
                        object.items.splice(pos, 1);
                    }
                }
                if (Object.keys(obj).length) {
                    save.element.setAttribute('data-visible', 'hidden');
                    save.hide();
                    loader.resize = function () {
                        this.element.style.left = '10px';
                        this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                    };
                    loader.show();
                    probes[0].move(obj);
                }
            }
            if (change.text.length > 1) for (var i = change.from.line; i < change.from.line+change.text.length-1; i++) object.items.splice(i, 0, '');
            if (!(change.origin === 'paste' && change.text.length === 1)) object.lineChange(editor.getCursor().line);
            object.pos = editor.getCursor().line;
            object.lineCount = editor.lineCount();
        }
    });
    object.editor = editor;
    object.index = function () {
        var pos = 0;
        editor.eachLine(function (line) {
            var text = line.text;
            object.items[pos] = text !== '' ? probes[0].join('users', user.input.value, 'lists', text+'.json') : '';
            pos++;
        });
        this.pos = editor.getCursor().line;
        this.lineCount = editor.lineCount();
    };
    object.line = function (text) {
        var pos = null;
        editor.eachLine(function (line) {
            if (line.text === text) pos = editor.getLineNumber(line);
        });
        return pos;
    };
    object.lineChange = function (pos) {
        this.clear();
        var text = editor.getLine(pos);
        if (text !== '') {
            loader.resize = function () {
                this.element.style.left = '10px';
                this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
            };
            loader.show();
            probes[0].load({listseditor:probes[0].join('users', user.input.value, 'lists', text+'.json')});
        }
        this.pos = pos;
    };
    object.load = function (content) {
        this.items = [];
        this.pos = null;
        this.lineCount = null;
        editor.operation(function () {
            var offset = 0;
            for (var i = 0; i < content.length; i++) {
                if (!/\.json$/.test(content[i])) {
                    content.splice(i-offset, 1);
                    offset++;
                }
            }
            var pattern = new RegExp(probes[0].join('users', user.input.value, 'lists')+probes[0].separator, 'g');
            editor.setValue(([''].concat(content).join('\n')+'\n').replace(pattern, '').replace(/\.json/g, ''));
            editor.clearHistory();
        });
        listseditor.load('');
        this.index();
    };
    object.clear = function () {
        CodeMirror.commands.clearSearch(editor);
        listseditor.clear();
        save.element.setAttribute('data-visible', 'hidden');
        save.hide();
    };
    return object;
};

alien.listseditor = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'listseditor';
    var inner = d.createElement('div');
    element.appendChild(inner);
    var object = new alien.element(element);
    object.inner = inner;
    object.load = function (content) {
        if (content !== '') {
            this.data = JSON.parse(content);
            var data = this.data,
                box = alien.box({
                    data: data,
                    fields: {
                        name: {
                            type: 'input',
                            placeholder: "Label name",
                            value: data.name
                        },
                        container: {
                            type: 'toggle',
                            buttons: [{
                                label: "NodeJS",
                                value: 'node'
                            }, {
                                label: "PhantomJS",
                                value: 'phantom'
                            }],
                            value: data.container
                        },
                        shell: {
                            type: 'input',
                            placeholder: "Shell",
                            value: data.shell,
                            info: 'See <a href="https://github.com/pschroen/shell" target="_blank">GitHub</a> for available shells.'
                        },
                        run: {
                            type: 'input',
                            placeholder: "Run mode",
                            value: data.run ? data.run.toString() : '',
                            info: '<code>true</code>, milliseconds or <code>forever</code>.'
                        }
                    }
                }, 0, element.id);
            box.element.style.top = '4px';
            box.show();
            this.box = box;
        }
        var text = listslist.editor.getLine(listslist.editor.getCursor().line);
        if (text !== '') {
            save.element.setAttribute('data-visible', 'visible');
            actionbox.resize();
            save.show();
        }
        listslist.editor.focus();
        probes[0].loading = false;
    };
    object.clear = function () {
        this.inner.innerHTML = '';
        this.data = null;
    };
    object.show = function () {
        if (this.element.getAttribute('data-visible') !== 'hidden') {
            this.element.style.visibility = 'visible';
            this.inner.style.visibility = 'visible';
            if (this.box) this.box.show();
        }
    };
    object.hide = function () {
        this.element.style.visibility = 'hidden';
        this.inner.style.visibility = 'hidden';
        if (this.box) this.box.hide();
    };
    return object;
};

alien.fileslist = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'fileslist';
    var object = new alien.element(element);
    object.items = [];
    object.pos = null;
    object.lineCount = null;
    var editor = CodeMirror(element, {
        theme: 'headless',
        mode: '',
        styleActiveLine: true,
        lineWrapping: true,
        showCursorWhenSelecting: true
    });
    editor.on('keyHandled', function (editor, name, e) {
        console.log(name+','+editor.getCursor().line);
        if (name === 'Enter') {
            var pos = editor.getCursor().line,
                text = editor.getLine(pos-1);
            if (text !== '') {
                pos = pos-1;
                editor.operation(function () {
                    editor.replaceRange('', {line:pos, ch:text.length}, {line:pos+1, ch:0});
                    editor.setCursor(pos, 0);
                });
                text = editor.getLine(pos);
                var path = probes[0].join(probes[0].files[probes[0].view.files].path, text);
                save.element.setAttribute('data-visible', 'hidden');
                save.hide();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                var obj = {};
                if (object.items[pos] && object.items[pos] !== '' && object.items[pos] !== path) {
                    obj[object.items[pos]] = path;
                    obj[path] = fileseditor.editor.getValue();
                    probes[0].move(obj);
                    object.items[pos] = path;
                } else {
                    obj[path] = fileseditor.editor.getValue();
                    probes[0].save(obj);
                    object.items[pos] = path;
                }
                object.lineChange(pos);
            }
            if (editor.lineCount() !== object.lineCount) object.index();
        } else if (name === 'Down' || name === 'Up' || name === 'Right' || name === 'Left') {
            var pos = editor.getCursor().line;
            if (pos !== object.pos) {
                if (!editor.somethingSelected()) {
                    object.lineChange(pos);
                } else if (editor.getSelection('|').split('|').length > 2) {
                    object.clear();
                    object.pos = pos;
                }
            }
        }
    });
    editor.on('mousedown', function (editor, e) {
        var pos = editor.coordsChar({left:e.pageX, top:e.pageY}).line;
        if (pos !== object.pos) {
            if (!editor.somethingSelected()) {
                object.lineChange(pos);
            } else if (editor.getSelection('|').split('|').length > 2) {
                object.clear();
                object.pos = pos;
            }
        }
    });
    editor.on('change', function (editor, change) {
        if (change.origin && change.origin !== 'setValue' && change.origin !== '+input') {
            if (change.removed.length > 1) {
                var obj = {},
                    pos = change.from.line;
                for (var i = pos; i < pos+change.removed.length-1; i++) {
                    if (object.items[pos]) {
                        obj[object.items[pos]] = '';
                        object.items.splice(pos, 1);
                    }
                }
                if (Object.keys(obj).length) {
                    save.element.setAttribute('data-visible', 'hidden');
                    save.hide();
                    loader.resize = function () {
                        this.element.style.left = '10px';
                        this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                    };
                    loader.show();
                    probes[0].move(obj);
                }
            }
            if (change.text.length > 1) for (var i = change.from.line; i < change.from.line+change.text.length-1; i++) object.items.splice(i, 0, '');
            if (!((change.origin === 'paste' || change.origin === '+delete') && change.text.length === 1)) object.lineChange(editor.getCursor().line);
            object.pos = editor.getCursor().line;
            object.lineCount = editor.lineCount();
        }
    });
    object.editor = editor;
    object.index = function () {
        var pos = 0;
        editor.eachLine(function (line) {
            var text = line.text;
            object.items[pos] = text !== '' ? probes[0].join(probes[0].files[probes[0].view.files].path, text) : '';
            pos++;
        });
        this.pos = editor.getCursor().line;
        this.lineCount = editor.lineCount();
    };
    object.line = function (text) {
        var pos = null;
        editor.eachLine(function (line) {
            if (line.text === text) pos = editor.getLineNumber(line);
        });
        return pos;
    };
    object.lineChange = function (pos) {
        this.clear();
        var text = editor.getLine(pos);
        if (text !== '') {
            loader.resize = function () {
                this.element.style.left = '10px';
                this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
            };
            loader.show();
            probes[0].load({fileseditor:probes[0].join(probes[0].files[probes[0].view.files].path, text)});
            fileseditor.editor.setOption('mode',
                /\.(xml|svg)/.test(text) ? 'xml' :
                /\.css/.test(text) ? 'css' :
                /\.js/.test(text) ? 'javascript' :
                /\.html/.test(text) ? 'htmlmixed' :
                /\.py/.test(text) ? 'python' :
                /\.sh/.test(text) ? 'shell' :
                ''
            );
        }
        this.pos = pos;
    };
    object.load = function (content) {
        this.items = [];
        this.pos = null;
        this.lineCount = null;
        editor.operation(function () {
            var pattern = new RegExp((probes[0].files[probes[0].view.files].path+probes[0].separator).replace('.'+probes[0].separator, ''), 'g');
            editor.setValue(([''].concat(content).join('\n')+'\n').replace(pattern, ''));
            editor.clearHistory();
        });
        this.index();
    };
    object.clearError = function () {
        editor.removeLineClass(editor.getCursor().line, 'background', 'error');
        fileseditor.editor.clearGutter('breakpoints');
        if (marker) {
            marker.clear();
            marker = null;
        }
        errmsg.element.innerHTML = '';
    };
    object.clear = function () {
        this.clearError();
        CodeMirror.commands.clearSearch(editor);
        fileseditor.clear();
        save.element.setAttribute('data-visible', 'hidden');
        save.hide();
    };
    return object;
};

alien.fileseditor = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'fileseditor';
    var object = new alien.element(element);
    var editor = CodeMirror(element, {
        theme: 'headless',
        mode: '',
        styleActiveLine: false,
        lineWrapping: false,
        lineNumbers: true,
        indentUnit: 4,
        matchBrackets: true,
        showCursorWhenSelecting: true,
        gutters: ['CodeMirror-linenumbers', 'breakpoints']
    });
    object.editor = editor;
    object.load = function (content) {
        editor.operation(function () {
            editor.setValue(content);
            editor.refresh();
            editor.clearHistory();
        });
        var text = fileslist.editor.getLine(fileslist.editor.getCursor().line);
        if (text !== '' && content !== 'binary') {
            save.element.setAttribute('data-visible', 'visible');
            actionbox.resize();
            save.show();
        }
        fileslist.editor.focus();
        probes[0].loading = false;
        probes[0].pullout();
    };
    object.clear = function () {
        editor.operation(function () {
            CodeMirror.commands.clearSearch(editor);
            editor.setValue('');
            editor.refresh();
            editor.setOption('mode', '');
            editor.clearHistory();
        });
    };
    return object;
};

alien.userslist = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'userslist';
    var object = new alien.element(element);
    object.items = [];
    object.pos = null;
    object.lineCount = null;
    var editor = CodeMirror(element, {
        theme: 'headless',
        mode: '',
        styleActiveLine: true,
        lineWrapping: true,
        showCursorWhenSelecting: true
    });
    editor.on('keyHandled', function (editor, name, e) {
        console.log(name+','+editor.getCursor().line);
        if (name === 'Enter') {
            var pos = editor.getCursor().line,
                text = editor.getLine(pos-1);
            if (text !== '') {
                pos = pos-1;
                editor.operation(function () {
                    editor.replaceRange(text.toLowerCase(), {line:pos, ch:0}, {line:pos+1, ch:0});
                    editor.setCursor(pos, 0);
                });
                text = editor.getLine(pos);
                var path = probes[0].join('users', text);
                save.element.setAttribute('data-visible', 'hidden');
                save.hide();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                var obj = {};
                if (object.items[pos] && object.items[pos] !== '' && object.items[pos] !== path) {
                    obj[object.items[pos]] = path;
                    obj[probes[0].join(path, 'auth.json')] = userseditor.data;
                    probes[0].move(obj);
                    object.items[pos] = path;
                } else {
                    if (userseditor.data) {
                        obj[probes[0].join(path, 'auth.json')] = userseditor.data;
                    } else {
                        obj[probes[0].join(path, 'auth.json')] = {
                            name: text,
                            auth: '',
                            key: '',
                            host: true
                        };
                        obj[probes[0].join(path, 'config.json')] = {
                            view: {
                                list: false,
                                lists: false,
                                files: false,
                                users: false,
                                log: false
                            },
                            files: [{
                                name: "Ghost",
                                path: path
                            }, {
                                name: "Shell",
                                path: 'shell'
                            }],
                            userAgent: navigator.userAgent
                        };
                    }
                    probes[0].save(obj);
                    object.items[pos] = path;
                }
                object.lineChange(pos);
            }
            if (editor.lineCount() !== object.lineCount) object.index();
        } else if (name === 'Down' || name === 'Up' || name === 'Right' || name === 'Left') {
            var pos = editor.getCursor().line;
            if (pos !== object.pos) {
                if (!editor.somethingSelected()) {
                    object.lineChange(pos);
                } else if (editor.getSelection('|').split('|').length > 2) {
                    object.clear();
                    object.pos = pos;
                }
            }
        }
    });
    editor.on('mousedown', function (editor, e) {
        var pos = editor.coordsChar({left:e.pageX, top:e.pageY}).line;
        if (pos !== object.pos) {
            if (!editor.somethingSelected()) {
                object.lineChange(pos);
            } else if (editor.getSelection('|').split('|').length > 2) {
                object.clear();
                object.pos = pos;
            }
        }
    });
    editor.on('change', function (editor, change) {
        if (change.origin && change.origin !== 'setValue' && change.origin !== '+input') {
            if (change.removed.length > 1) {
                var obj = {},
                    pos = change.from.line;
                for (var i = pos; i < pos+change.removed.length-1; i++) {
                    if (object.items[pos]) {
                        obj[object.items[pos]] = '';
                        object.items.splice(pos, 1);
                    }
                }
                if (Object.keys(obj).length) {
                    save.element.setAttribute('data-visible', 'hidden');
                    save.hide();
                    loader.resize = function () {
                        this.element.style.left = '10px';
                        this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                    };
                    loader.show();
                    probes[0].move(obj);
                }
            }
            if (change.text.length > 1) for (var i = change.from.line; i < change.from.line+change.text.length-1; i++) object.items.splice(i, 0, '');
            if (!(change.origin === 'paste' && change.text.length === 1)) object.lineChange(editor.getCursor().line);
            object.pos = editor.getCursor().line;
            object.lineCount = editor.lineCount();
        }
    });
    object.editor = editor;
    object.index = function () {
        var pos = 0;
        editor.eachLine(function (line) {
            var text = line.text;
            object.items[pos] = text !== '' ? probes[0].join('users', text) : '';
            pos++;
        });
        this.pos = editor.getCursor().line;
        this.lineCount = editor.lineCount();
    };
    object.line = function (text) {
        var pos = null;
        editor.eachLine(function (line) {
            if (line.text === text) pos = editor.getLineNumber(line);
        });
        return pos;
    };
    object.lineChange = function (pos) {
        this.clear();
        var text = editor.getLine(pos);
        if (text !== '') {
            loader.resize = function () {
                this.element.style.left = '10px';
                this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
            };
            loader.show();
            probes[0].load({userseditor:probes[0].join('users', text, 'auth.json')});
        }
        this.pos = pos;
    };
    object.load = function (content) {
        this.items = [];
        this.pos = null;
        this.lineCount = null;
        editor.operation(function () {
            editor.setValue([''].concat(content).join('\n')+'\n');
            editor.clearHistory();
        });
        userseditor.load('');
        this.index();
    };
    object.clear = function () {
        CodeMirror.commands.clearSearch(editor);
        userseditor.clear();
        save.element.setAttribute('data-visible', 'hidden');
        save.hide();
    };
    return object;
};

alien.userseditor = function () {
    "use strict";
    var element = d.createElement('div');
    element.id = 'userseditor';
    var inner = d.createElement('div');
    element.appendChild(inner);
    var object = new alien.element(element);
    object.inner = inner;
    object.load = function (content) {
        if (content !== '') {
            this.data = JSON.parse(content);
            var data = this.data,
                box = alien.box({
                    data: data,
                    fields: {
                        namespace: {
                            type: 'api',
                            data: {
                                name: data.name,
                                submit: 'headless.io/namespace'
                            }
                        }
                    }
                }, 0, element.id);
            box.element.style.top = '4px';
            box.show();
            this.box = box;
        }
        var text = userslist.editor.getLine(userslist.editor.getCursor().line);
        if (text !== '') {
            save.element.setAttribute('data-visible', 'visible');
            actionbox.resize();
            save.show();
        }
        userslist.editor.focus();
        probes[0].loading = false;
    };
    object.clear = function () {
        this.inner.innerHTML = '';
        this.data = null;
    };
    object.show = function () {
        if (this.element.getAttribute('data-visible') !== 'hidden') {
            this.element.style.visibility = 'visible';
            this.inner.style.visibility = 'visible';
            if (this.box) this.box.show();
        }
    };
    object.hide = function () {
        this.element.style.visibility = 'hidden';
        this.inner.style.visibility = 'hidden';
        if (this.box) this.box.hide();
    };
    return object;
};

alien.log = function () {
    "use strict";
    var element = d.createElement('div');
    element.className = 'log';
    var object = new alien.element(element);
    return object;
};

alien.box = function (box, index, id) {
    "use strict";
    var submit = false,
        boxgroup = alien.group([], id ? window[id].inner : null);
    for (var key in box.fields) {
        var field = box.fields[key];
        switch (field.type) {
        case 'input':
            var group = alien.group();
            var input = alien.input(field.placeholder, field.password, field.maxlength);
            input.input.style.width = input.element.style.width = (
                !field.maxlength || field.maxlength > 15 ? 128 :
                field.maxlength > 3 ? field.maxlength*8 :
                field.maxlength > 2 ? field.maxlength*9 :
                field.maxlength*11
            )+'px';
            input.element.onsubmit = function () {
                if (save.element.getAttribute('data-visible') !== 'hidden') save.element.onclick();
                return false;
            };
            if (field.value) input.input.value = field.value;
            group.addObject(input);
            group.input = input;
            if (field.info) {
                var info = alien.info('', '', '', field.info);
                info.element.style.top = input.element.offsetTop+input.element.offsetHeight+4+'px';
                group.addObject(info);
                group.info = info;
            }
            group.resize = function () {
                var maxwidth = d.documentElement.offsetWidth > 500 ? 480 : d.documentElement.offsetWidth-20;
                this.bounds();
                if (this.lastgroup) {
                    if (!(!this.field.maxlength || this.field.maxlength > 15) && this.lastgroup.element.offsetLeft+this.lastgroup.element.offsetWidth+10+this.element.offsetWidth <= maxwidth) {
                        this.element.style.left = this.lastgroup.element.offsetLeft+this.lastgroup.element.offsetWidth+10+'px';
                        this.element.style.top = this.lastgroup.element.offsetTop+'px';
                    } else {
                        this.element.style.left = '0px';
                        this.element.style.top = this.lastgroup.element.offsetTop+this.lastgroup.element.offsetHeight+10+'px';
                    }
                }
            };
            group.field = field;
            group.lastgroup = boxgroup.objects.length ? boxgroup.objects[boxgroup.objects.length-1] : null;
            group.resize();
            boxgroup.addObject(group);
            boxgroup[key] = input;
            if (key === 'auth') submit = true;
            break;
        case 'toggle':
            var group = alien.group();
            var buttons = [];
            for (var i = 0; i < field.buttons.length; i++) {
                var button = alien.button(field.buttons[i].label);
                button.element.style.left = (buttons.length ? buttons[buttons.length-1].element.offsetLeft+buttons[buttons.length-1].element.offsetWidth+10 : 0)+'px';
                button.element.className = 'btn'+(field.buttons[i].value === field.value ? ' pressed' : '')+' small';
                button.element.setAttribute('data-value', field.buttons[i].value);
                button.element.setAttribute('data-key', key);
                button.element.setAttribute('data-id', id);
                button.element.onclick = function () {
                    if (this.className !== 'btn pressed small') {
                        var value = this.getAttribute('data-value'),
                            key = this.getAttribute('data-key'),
                            id = this.getAttribute('data-id'),
                            box = window[id].box;
                        for (var i = 0; i < box[key].length; i++) box[key][i].element.className = 'btn small';
                        this.className = 'btn pressed small';
                        box.data[key] = value;
                    }
                };
                buttons.push(button);
            }
            group.addObject(alien.group(buttons));
            group.buttons = buttons;
            if (field.info) {
                var info = alien.info('', '', '', field.info);
                group.addObject(info);
                group.info = info;
            }
            group.resize = function () {
                var maxwidth = d.documentElement.offsetWidth > 500 ? 480 : d.documentElement.offsetWidth-20;
                if (this.field.info) {
                    var lastbutton = this.buttons[this.buttons.length-1];
                    if (lastbutton.element.offsetLeft+lastbutton.element.offsetWidth+10+this.info.element.offsetWidth <= maxwidth) {
                        this.info.element.style.left = lastbutton.element.offsetLeft+lastbutton.element.offsetWidth+10+'px';
                        this.info.element.style.top = lastbutton.element.offsetTop+4+'px';
                    } else {
                        this.info.element.style.left = '0px';
                        this.info.element.style.top = lastbutton.element.offsetTop+lastbutton.element.offsetHeight+4+'px';
                    }
                }
                this.bounds();
                if (this.lastgroup) {
                    if (this.lastgroup.element.offsetLeft+this.lastgroup.element.offsetWidth+10+this.element.offsetWidth <= maxwidth) {
                        this.element.style.left = this.lastgroup.element.offsetLeft+this.lastgroup.element.offsetWidth+10+'px';
                        this.element.style.top = this.lastgroup.element.offsetTop+'px';
                    } else {
                        this.element.style.left = '0px';
                        this.element.style.top = this.lastgroup.element.offsetTop+this.lastgroup.element.offsetHeight+10+'px';
                    }
                }
            };
            group.field = field;
            group.lastgroup = boxgroup.objects.length ? boxgroup.objects[boxgroup.objects.length-1] : null;
            group.resize();
            boxgroup.addObject(group);
            boxgroup[key] = buttons;
            box.data[key] = field.value;
            break;
        case 'buttons':
            var group = alien.group();
            var buttons = [];
            for (var i = 0; i < field.buttons.length; i++) {
                var button = alien.button(field.buttons[i].label);
                button.element.style.left = (buttons.length ? buttons[buttons.length-1].element.offsetLeft+buttons[buttons.length-1].element.offsetWidth+10 : 0)+'px';
                button.element.setAttribute('data-value', JSON.stringify(field.buttons[i].value));
                button.element.setAttribute('data-name', field.buttons[i].name);
                button.element.setAttribute('data-key', key);
                button.element.setAttribute('data-id', id);
                button.element.onclick = function () {
                    if (this.className !== 'btn pressed small') {
                        var value = JSON.parse(this.getAttribute('data-value')),
                            name = this.getAttribute('data-name'),
                            key = this.getAttribute('data-key'),
                            id = this.getAttribute('data-id'),
                            box = window[id].box;
                        this.className = 'btn pressed small';
                        if (value && typeof value === "string") box.data[key] = value;
                        if (name === 'api') {
                            for (var x in box) if (box[x] && box[x].input) box.data[x] = box[x].input.value;
                            box.data.id = id;
                            probes[0].api(box.data);
                        }
                        setTimeout(function () {
                            box.element.innerHTML = '';
                            if (value && typeof value === "object") {
                                box = alien.box(value, 0, id);
                                box.show();
                                window[id].box = box;
                            } else if (name === 'api') {
                                save.element.setAttribute('data-visible', 'hidden');
                                save.hide();
                                var boxloader = alien.loader();
                                boxloader.element.style.left = '0px';
                                boxloader.element.style.top = '1px';
                                alien.group([boxloader], box.element).show();
                            }
                        }, 100);
                    }
                };
                buttons.push(button);
            }
            group.addObject(alien.group(buttons));
            group.buttons = buttons;
            if (field.info) {
                var info = alien.info('', '', '', field.info);
                group.addObject(info);
                group.info = info;
            }
            group.resize = function () {
                var maxwidth = d.documentElement.offsetWidth > 500 ? 480 : d.documentElement.offsetWidth-20;
                if (this.field.info) {
                    var lastbutton = this.buttons[this.buttons.length-1];
                    if (lastbutton.element.offsetLeft+lastbutton.element.offsetWidth+10+this.info.element.offsetWidth <= maxwidth) {
                        this.info.element.style.left = lastbutton.element.offsetLeft+lastbutton.element.offsetWidth+10+'px';
                        this.info.element.style.top = lastbutton.element.offsetTop+4+'px';
                    } else {
                        this.info.element.style.left = '0px';
                        this.info.element.style.top = lastbutton.element.offsetTop+lastbutton.element.offsetHeight+4+'px';
                    }
                }
                this.bounds();
                if (this.lastgroup) {
                    if (this.lastgroup.element.offsetLeft+this.lastgroup.element.offsetWidth+10+this.element.offsetWidth <= maxwidth) {
                        this.element.style.left = this.lastgroup.element.offsetLeft+this.lastgroup.element.offsetWidth+10+'px';
                        this.element.style.top = this.lastgroup.element.offsetTop+'px';
                    } else {
                        this.element.style.left = '0px';
                        this.element.style.top = this.lastgroup.element.offsetTop+this.lastgroup.element.offsetHeight+10+'px';
                    }
                }
            };
            group.field = field;
            group.lastgroup = boxgroup.objects.length ? boxgroup.objects[boxgroup.objects.length-1] : null;
            group.resize();
            boxgroup.addObject(group);
            boxgroup[key] = buttons;
            break;
        case 'info':
            var group = alien.group();
            var info = alien.info(field.title, field.text, field.credits, field.info);
            group.addObject(info);
            group.info = info;
            if (field.buttons) {
                var buttons = [];
                for (var i = 0; i < field.buttons.length; i++) {
                    var button = alien.button(field.buttons[i].label);
                    button.element.style.left = (buttons.length ? buttons[buttons.length-1].element.offsetLeft+buttons[buttons.length-1].element.offsetWidth+10 : 0)+'px';
                    button.element.setAttribute('data-index', index);
                    if (field.buttons[i].item) button.element.setAttribute('data-item', JSON.stringify(field.buttons[i].item));
                    button.element.onclick = function () {
                        this.className = 'btn pressed small';
                        var index = parseInt(this.getAttribute('data-index'), 10),
                            item = this.getAttribute('data-item') ? JSON.parse(this.getAttribute('data-item')) : null,
                            text = infobox.data.text;
                        if (item) for (var x in item) memory[text].item[x] = item[x];
                        if (item && (item.action || item.index !== undefined)) {
                            memory[text].item.infobox = infobox.data;
                            memory[text].item.infobox.index = index;
                            probes[0].run(text);
                        } else if (memory[text] && memory[text].item) {
                            delete memory[text].item.infobox;
                            delete memory[text].item.action;
                            delete memory[text].item.index;
                            probes[0].merge();
                        }
                        setTimeout(function () {
                            if (infoboxes.length === 1) {
                                infobox.element.setAttribute('data-visible', 'hidden');
                                infobox.hide();
                                listeditor.editor.focus();
                                infobox.element.parentNode.removeChild(infobox.element);
                                infobox = null;
                                infoboxes = [];
                            } else {
                                infoboxes.shift();
                                infobox.element.parentNode.removeChild(infobox.element);
                                infobox = infoboxes[0];
                                infobox.element.setAttribute('data-visible', 'visible');
                                infobox.show();
                            }
                        }, 100);
                    };
                    buttons.push(button);
                }
                var buttonsgroup = alien.group(buttons);
                group.addObject(buttonsgroup);
                group.buttonsgroup = buttonsgroup;
                group.buttons = buttons;
            }
            group.resize = function () {
                var maxwidth = d.documentElement.offsetWidth > 500 ? 480 : d.documentElement.offsetWidth-20;
                this.info.element.style.width = maxwidth-this.info.element.offsetLeft+'px';
                if (this.buttonsgroup) this.buttonsgroup.element.style.top = this.info.element.offsetHeight+10+'px';
                if (this.lastgroup) this.element.style.top = this.lastgroup.element.offsetTop+this.lastgroup.element.offsetHeight+10+'px';
                this.element.style.width = maxwidth+'px';
                this.element.style.height = (this.buttonsgroup ?
                    this.buttonsgroup.element.offsetTop+this.buttonsgroup.element.offsetHeight :
                    this.info.element.offsetTop+this.info.element.offsetHeight
                )+'px';
            };
            group.field = field;
            group.lastgroup = boxgroup.objects.length ? boxgroup.objects[boxgroup.objects.length-1] : null;
            group.resize();
            boxgroup.addObject(group);
            break;
        case 'api':
            field.data.id = id;
            probes[0].api(field.data);
            save.element.setAttribute('data-visible', 'hidden');
            save.hide();
            var boxloader = alien.loader();
            boxloader.element.style.left = '0px';
            boxloader.element.style.top = '1px';
            var group = alien.group([boxloader]);
            group.resize = function () {
                if (this.lastgroup) this.element.style.top = this.lastgroup.element.offsetTop+this.lastgroup.element.offsetHeight+10+'px';
            };
            group.field = field;
            group.lastgroup = boxgroup.objects.length ? boxgroup.objects[boxgroup.objects.length-1] : null;
            group.resize();
            boxgroup.addObject(group);
            break;
        }
    }
    if (submit) {
        save.element.setAttribute('data-visible', 'visible');
        actionbox.resize();
        save.show();
    } else {
        save.element.setAttribute('data-visible', 'hidden');
        save.hide();
    }
    boxgroup.data = box.data;
    return boxgroup;
};

alien.info = function (title, text, credits, info) {
    "use strict";
    var html = '';
    if (title && title !== '') html += '<b>'+title+'</b>';
    if (text && text !== '') html += '<br>&nbsp;&nbsp;&nbsp;&nbsp;'+text;
    if (credits) {
        credits.reverse();
        for (var i = 0; i < credits.length; i++) {
            var credit = credits[i];
            html += '<span class="credits">&nbsp;&nbsp;← <a href="'+credit.href+'" target="_blank">'+credit.title+'</a></span>';
        }
    }
    if (info) html += '<span class="info">'+info+'</span>';
    var element = d.createElement('div');
    element.className = 'info';
    element.innerHTML = html;
    var object = new alien.element(element);
    return object;
};

alien.error = function () {
    "use strict";
    var element = d.createElement('div');
    element.className = 'error';
    var object = new alien.element(element);
    return object;
};

var loader = new alien.loader();

var welcome = alien.welcome("Welcome to the Headless Web");
welcome.resize = function () {
    "use strict";
    this.element.style.top = parseInt((d.documentElement.offsetHeight-this.element.offsetHeight)/5, 10)+'px';
};
interfaces.welcome = welcome;

var user = alien.input("Username");
user.element.onsubmit = function () {
    "use strict";
    if (probe.element.className !== 'btn pressed') {
        if (user.input.value !== '' && pass.input.value !== '') {
            noghost.hide();
            delete noghost.resize;
            probe.element.className = 'btn pressed';
            loader.resize = function () {
                this.element.style.left = form.element.offsetLeft+form.element.offsetWidth+12+'px';
                this.element.style.top = form.element.offsetTop+probe.element.offsetTop+7+'px';
            };
            loader.show();
            socket.send(JSON.stringify({
                message: 'request',
                data: {
                    name: user.input.value,
                    auth: pass.input.value,
                    userAgent: navigator.userAgent
                },
                time: Date.now()
            }));
        } else if (user.input.value === '') {
            user.input.focus();
        } else if (pass.input.value === '') {
            pass.input.focus();
        }
    }
    return false;
};

var match = /(.*)\.headless\.io/.exec(location.hostname);
user.input.value = match && /\./.test(match[1]) ? match[1].split('.')[0] : match ? match[1] : '';

var pass = alien.input("Password", true);
if (!match) pass.element.style.top = user.element.offsetTop+user.element.offsetHeight+10+'px';
pass.element.onsubmit = user.element.onsubmit;

var probe = alien.button("Probe", true);
probe.element.style.left = pass.element.offsetLeft+pass.element.offsetWidth-2+'px';
probe.element.style.top = pass.element.offsetTop-3+'px';
probe.element.onclick = user.element.onsubmit;

var form = alien.group(!match ? [user, pass, probe] : [pass, probe]);
form.resize = function () {
    "use strict";
    this.element.style.left = parseInt((d.documentElement.offsetWidth-this.element.offsetWidth)/2, 10)+'px';
    this.element.style.top = welcome.element.offsetTop+welcome.element.offsetHeight+40+'px';
};
interfaces.form = form;

var noghost = alien.info('', '', '', 'No ghost line');

var legal = alien.legal();
legal.element.onclick = function () {};
legal.resize = function () {
    "use strict";
    this.element.style.left = d.documentElement.offsetWidth-this.element.offsetWidth-10+'px';
    this.element.style.top = d.documentElement.offsetHeight-this.element.offsetHeight-10+'px';
};
interfaces.legal = legal;

var github = alien.github();
github.resize = function () {
    "use strict";
    this.element.style.display = d.documentElement.offsetWidth > 1023 ? 'block' : 'none';
};
interfaces.github = github;

for (var x in interfaces) {
    interfaces[x].resize();
    interfaces[x].show();
}
if (user.input.value === '') {
    user.input.focus();
} else if (pass.input.value === '') {
    pass.input.focus();
}
pages[0] = interfaces;


interfaces = {};

var probename = alien.probename();
probename.element.style.left = '13px';
probename.element.style.top = '7px';
probename.element.onclick = function () {};
probename.resize = function () {};
interfaces.probename = probename;

var mothership = alien.button("Mothership");
mothership.element.style.top = '10px';
mothership.element.onclick = function () {
    "use strict";
    if (this.className !== 'btn pressed small') {
        this.className = 'btn pressed small';
        for (var i = 0; i < listgroup.objects.length; i++) listgroup.objects[i].element.className = 'btn small';
        lists.element.className = 'btn small';
        for (var i = 0; i < filesgroup.objects.length; i++) filesgroup.objects[i].element.className = 'btn small';
        run.element.setAttribute('data-visible', 'hidden');
        save.element.setAttribute('data-visible', 'hidden');
        restart.element.setAttribute('data-visible', 'hidden');
        run.hide();
        save.hide();
        restart.hide();
        listbox.hide();
        listsbox.hide();
        filesbox.hide();
        probes[0].view.list = false;
        probes[0].view.lists = false;
        probes[0].view.files = false;
        probes[0].view.users = true;
        probes[0].merge();
        fileslist.clearError();
        userslist.editor.setValue('');
        userseditor.inner.innerHTML = '';
        listbox.resize();
        listsbox.resize();
        filesbox.resize();
        usersbox.resize();
        logbox.resize();
        actionbox.resize();
        if (infobox) infobox.resize();
        usersbox.show();
        loader.resize = function () {
            this.element.style.left = '10px';
            this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
        };
        loader.show();
        probes[0].load({userslist:'users'});
        userslist.editor.focus();
    } else {
        this.className = 'btn small';
        save.element.setAttribute('data-visible', 'hidden');
        save.hide();
        usersbox.hide();
        probes[0].view.list = false;
        probes[0].view.lists = false;
        probes[0].view.files = false;
        probes[0].view.users = false;
        probes[0].merge();
        listbox.resize();
        listsbox.resize();
        filesbox.resize();
        usersbox.resize();
        logbox.resize();
        actionbox.resize();
        if (infobox) infobox.resize();
    }
};
mothership.resize = function () {
    "use strict";
    this.element.style.display = d.documentElement.offsetWidth > 479 ? 'block' : 'none';
    this.element.style.left = d.documentElement.offsetWidth-this.element.offsetWidth-10+'px';
};
interfaces.mothership = mothership;

var log = alien.button("Log");
log.element.style.top = '10px';
log.element.onclick = function () {
    "use strict";
    if (this.className !== 'btn pressed small') {
        this.className = 'btn pressed small';
        probes[0].view.log = true;
        probes[0].merge();
        listeditor.editor.setOption('lineNumbers', true);
        listbox.resize();
        listsbox.resize();
        filesbox.resize();
        usersbox.resize();
        logbox.resize();
        actionbox.resize();
        if (infobox) infobox.resize();
        logbox.element.scrollLeft = 0;
        logbox.show();
    } else {
        this.className = 'btn small';
        logbox.hide();
        probes[0].view.log = false;
        probes[0].merge();
        listeditor.editor.setOption('lineNumbers', false);
        listbox.resize();
        listsbox.resize();
        filesbox.resize();
        usersbox.resize();
        logbox.resize();
        actionbox.resize();
        if (infobox) infobox.resize();
    }
    if (probes[0].view.list !== false) {
        listeditor.editor.focus();
    } else if (probes[0].view.lists) {
        listslist.editor.focus();
    } else if (probes[0].view.files !== false) {
        fileslist.editor.focus();
    } else if (probes[0].view.users) {
        userslist.editor.focus();
    }
};
log.resize = function () {
    "use strict";
    this.element.style.display = d.documentElement.offsetWidth > 479 ? 'block' : 'none';
    this.element.style.left = mothership.element.offsetLeft-this.element.offsetWidth-10+'px';
};
interfaces.log = log;

var listgroup = alien.group();
listgroup.element.style.top = '10px';
listgroup.resize = function () {
    "use strict";
    if (this.objects.length) {
        this.element.style.left = probename.element.offsetLeft+probename.element.offsetWidth+10+'px';
        var maxwidth = d.documentElement.offsetWidth-20-this.element.offsetLeft-log.element.offsetWidth-10-mothership.element.offsetWidth-10;
        for (var i = 0; i < this.objects.length; i++) this.objects[i].element.style.visibility = this.objects[i].element.offsetLeft+this.objects[i].element.offsetWidth <= maxwidth ? 'visible' : 'hidden';
    }
};
interfaces.listgroup = listgroup;

var lists = alien.button("Lists");
lists.element.style.top = '10px';
lists.element.onclick = function () {
    "use strict";
    if (this.className !== 'btn pressed small') {
        this.className = 'btn pressed small';
        for (var i = 0; i < listgroup.objects.length; i++) listgroup.objects[i].element.className = 'btn small';
        for (var i = 0; i < filesgroup.objects.length; i++) filesgroup.objects[i].element.className = 'btn small';
        mothership.element.className = 'btn small';
        run.element.setAttribute('data-visible', 'hidden');
        save.element.setAttribute('data-visible', 'hidden');
        restart.element.setAttribute('data-visible', 'hidden');
        run.hide();
        save.hide();
        restart.hide();
        listbox.hide();
        listsbox.hide();
        filesbox.hide();
        usersbox.hide();
        probes[0].view.list = false;
        probes[0].view.lists = true;
        probes[0].view.files = false;
        probes[0].view.users = false;
        probes[0].merge();
        fileslist.clearError();
        listslist.editor.setValue('');
        listseditor.inner.innerHTML = '';
        listbox.resize();
        listsbox.resize();
        filesbox.resize();
        usersbox.resize();
        logbox.resize();
        actionbox.resize();
        if (infobox) infobox.resize();
        listsbox.show();
        loader.resize = function () {
            this.element.style.left = '10px';
            this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
        };
        loader.show();
        probes[0].load({listslist:probes[0].join('users', user.input.value, 'lists')});
        listslist.editor.focus();
    } else {
        this.className = 'btn small';
        save.element.setAttribute('data-visible', 'hidden');
        save.hide();
        listsbox.hide();
        probes[0].view.list = false;
        probes[0].view.lists = false;
        probes[0].view.files = false;
        probes[0].view.users = false;
        probes[0].merge();
        listbox.resize();
        listsbox.resize();
        filesbox.resize();
        usersbox.resize();
        logbox.resize();
        actionbox.resize();
        if (infobox) infobox.resize();
    }
};
lists.resize = function () {
    "use strict";
    this.element.style.left = (
        listgroup.objects.length ? listgroup.element.offsetLeft+listgroup.element.offsetWidth : probename.element.offsetLeft+probename.element.offsetWidth
    )+10+'px';
    var maxwidth = d.documentElement.offsetWidth-20-this.element.offsetLeft-log.element.offsetWidth-10-mothership.element.offsetWidth-10;
    this.element.style.visibility = this.element.offsetWidth <= maxwidth ? 'visible' : 'hidden';
};
interfaces.lists = lists;

var filesgroup = alien.group();
filesgroup.element.style.top = '10px';
filesgroup.resize = function () {
    "use strict";
    if (this.objects.length) {
        this.element.style.left = lists.element.offsetLeft+lists.element.offsetWidth+10+'px';
        var maxwidth = d.documentElement.offsetWidth-20-this.element.offsetLeft-log.element.offsetWidth-10-mothership.element.offsetWidth-10;
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].element.style.visibility = this.objects[i].element.offsetLeft+this.objects[i].element.offsetWidth <= maxwidth ? 'visible' : 'hidden';
            this.objects[i].element.style.display = this.objects[i].element.offsetLeft+this.objects[i].element.offsetWidth <= maxwidth ? 'block' : 'none';
        }
    }
};
interfaces.filesgroup = filesgroup;

var listeditor = alien.listeditor();
var listgutter = alien.listgutter();
listgutter.element.style.top = '4px';
listgutter.element.style.left = listeditor.element.offsetWidth+10+'px';

var listbox = alien.group([listeditor, listgutter]);
listbox.element.style.left = '10px';
listbox.element.style.top = '50px';
listbox.resize = function () {
    "use strict";
    this.element.style.height = d.documentElement.offsetHeight-96+'px';
    listeditor.element.style.height = this.element.offsetHeight+'px';
    listgutter.element.style.height = this.element.offsetHeight+'px';
};
interfaces.listbox = listbox;

var listslist = alien.listslist();
var listseditor = alien.listseditor();
listseditor.element.style.left = listslist.element.offsetWidth+20+'px';

var listsbox = alien.group([listslist, listseditor]);
listsbox.element.style.left = '10px';
listsbox.element.style.top = '50px';
listsbox.resize = function () {
    "use strict";
    this.element.style.height = d.documentElement.offsetHeight-96+'px';
    listslist.element.style.height = this.element.offsetHeight+'px';
    listseditor.element.style.height = this.element.offsetHeight+'px';
};
interfaces.listsbox = listsbox;

var fileslist = alien.fileslist();
var fileseditor = alien.fileseditor();
fileseditor.element.style.left = fileslist.element.offsetWidth+20+'px';

var filesbox = alien.group([fileslist, fileseditor]);
filesbox.element.style.left = '10px';
filesbox.element.style.top = '50px';
filesbox.resize = function () {
    "use strict";
    fileseditor.element.style.width = probes[0].view.log ? '620px' : d.documentElement.offsetWidth-fileslist.element.offsetWidth-40+'px';
    this.element.style.height = d.documentElement.offsetHeight-96+'px';
    fileslist.element.style.height = this.element.offsetHeight+'px';
    fileseditor.element.style.height = this.element.offsetHeight+'px';
    fileseditor.editor.setSize(fileseditor.element.offsetWidth, this.element.offsetHeight);
};
interfaces.filesbox = filesbox;

var userslist = alien.userslist();
var userseditor = alien.userseditor();
userseditor.element.style.left = userslist.element.offsetWidth+20+'px';

var usersbox = alien.group([userslist, userseditor]);
usersbox.element.style.left = '10px';
usersbox.element.style.top = '50px';
usersbox.resize = function () {
    "use strict";
    this.element.style.height = d.documentElement.offsetHeight-96+'px';
    userslist.element.style.height = this.element.offsetHeight+'px';
    userseditor.element.style.height = this.element.offsetHeight+'px';
};
interfaces.usersbox = usersbox;

var logbox = alien.log();
logbox.resize = function () {
    "use strict";
    if (probes[0].view.list !== false) {
        this.element.style.left = listbox.element.offsetLeft+listbox.element.offsetWidth+20+'px';
    } else if (probes[0].view.lists) {
        this.element.style.left = listsbox.element.offsetLeft+listsbox.element.offsetWidth+20+'px';
    } else if (probes[0].view.files !== false) {
        this.element.style.left = filesbox.element.offsetLeft+filesbox.element.offsetWidth+20+'px';
    } else if (probes[0].view.users) {
        this.element.style.left = usersbox.element.offsetLeft+usersbox.element.offsetWidth+20+'px';
    } else {
        this.element.style.left = 10+'px';
    }
    this.element.style.width = d.documentElement.offsetWidth-this.element.offsetLeft-10+'px';
    this.element.style.height = d.documentElement.offsetHeight-96+'px';
    this.element.style.top = listbox.element.offsetTop+4+'px';
};
interfaces.logbox = logbox;

var run = alien.button("Run");
run.element.onclick = function () {
    "use strict";
    if (this.className !== 'btn pressed small') {
        this.className = 'btn pressed small';
        var text = listeditor.editor.getLine(listeditor.editor.getCursor().line);
        if (probes[0].lists[probes[0].view.list].list.shell === 'api') {
            window.open('https://'+location.host+'/'+text);
            setTimeout(function () {
                run.element.className = 'btn small';
            }, 100);
            if (!probes[0].view.log) log.element.onclick();
        } else {
            probes[0].run(text !== '' ? text : undefined);
        }
    } else {
        this.className = 'btn small';
        probes[0].kill();
    }
};

var save = alien.button("Save");
save.element.onclick = function () {
    "use strict";
    if (this.className !== 'btn pressed small') {
        this.className = 'btn pressed small';
        if (probes[0].view.lists) {
            var text = listslist.editor.getLine(listslist.editor.getCursor().line);
            if (text !== '') {
                save.element.setAttribute('data-visible', 'hidden');
                save.hide();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                var obj = {};
                for (var x in listseditor.box) {
                    if (listseditor.box[x] && listseditor.box[x].input) {
                        var value = listseditor.box[x].input.value;
                        listseditor.data[x] = value === '' ? undefined : value === 'true' ? true : value === 'false' ? false : !isNaN(value) ? Number(value) : value;
                    }
                }
                obj[probes[0].join('users', user.input.value, 'lists', text+'.json')] = listseditor.data;
                probes[0].hash(obj);
                setTimeout(function () {
                    save.element.className = 'btn small';
                }, 100);
            }
        } else if (probes[0].view.files !== false) {
            var pos = fileslist.editor.getCursor().line,
                text = fileslist.editor.getLine(pos);
            if (text !== '') {
                save.element.setAttribute('data-visible', 'hidden');
                save.hide();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                var obj = {},
                    ghostconfig = probes[0].join('users', user.input.value, 'config.json'),
                    ghosthash = probes[0].join(probes[0].files[probes[0].view.files].path, text).replace('.'+this.separator, '') === ghostconfig,
                    jshint = function (value) {
                        JSHINT(fileseditor.editor.getValue());
                        if (JSHINT.errors.length) {
                            var err = JSHINT.errors[0];
                            if (err) {
                                error = {
                                    path: text,
                                    line: err.line-1,
                                    ch: err.character-1,
                                    message: err.reason,
                                    stack: null
                                };
                                fileslist.editor.addLineClass(fileslist.editor.getCursor().line, 'background', 'error');
                                var makeMarker = function () {
                                    var marker = d.createElement('div');
                                    marker.style.color = '#822';
                                    marker.innerHTML = '●';
                                    return marker;
                                };
                                var editor = fileseditor.editor;
                                editor.operation(function () {
                                    editor.clearGutter('breakpoints');
                                    if (marker) marker.clear();
                                    editor.setGutterMarker(error.line, 'breakpoints', makeMarker());
                                    marker = editor.markText({line:error.line, ch:error.ch}, {line:error.line, ch:error.ch+1}, {className:'CodeMirror-headless-mark-error'});
                                    editor.scrollIntoView({line:error.line}, 200);
                                    editor.setCursor(error.line, error.ch);
                                });
                                errmsg.element.innerHTML = error.message;
                                errmsg.show();
                                error = null;
                            }
                            return false;
                        } else {
                            fileslist.clearError();
                            return true;
                        }
                    };
                if (ghosthash && jshint(fileseditor.editor.getValue())) {
                    probes[0].ghost = JSON.parse(fileseditor.editor.getValue());
                } else {
                    obj[probes[0].join(probes[0].files[probes[0].view.files].path, text)] = fileseditor.editor.getValue();
                }
                probes[0].ghost.files[probes[0].view.files].memory = {
                    fileslist: {
                        left: fileslist.editor.getScrollInfo().left,
                        top: fileslist.editor.getScrollInfo().top,
                        line: fileslist.editor.getCursor().line,
                        ch: fileslist.editor.getCursor().ch
                    },
                    fileseditor: {
                        pos: fileslist.editor.getCursor().line,
                        left: fileseditor.editor.getScrollInfo().left,
                        top: fileseditor.editor.getScrollInfo().top,
                        line: fileseditor.editor.getCursor().line,
                        ch: fileseditor.editor.getCursor().ch
                    }
                };
                obj[ghostconfig] = probes[0].ghost;
                if (ghosthash) {
                    probes[0].hash(obj);
                } else {
                    probes[0].save(obj);
                }
                setTimeout(function () {
                    save.element.className = 'btn small';
                    if (probes[0].files[probes[0].view.files].path === '.' && (
                            /^config\.js/.test(text) ||
                            /^container\.js/.test(text) ||
                            /^headless-cert\.pem/.test(text) ||
                            /^headless-key\.pem/.test(text) ||
                            /^headless\.js/.test(text) ||
                            /^modules/.test(text) ||
                            /^package\.json/.test(text)
                        )) {
                        restart.element.setAttribute('data-visible', 'visible');
                        actionbox.resize();
                        restart.show();
                    }
                    if (/\.js/.test(text)) jshint(fileseditor.editor.getValue());
                }, 100);
            }
        } else if (probes[0].view.users) {
            var text = userslist.editor.getLine(userslist.editor.getCursor().line);
            if (text !== '') {
                save.element.setAttribute('data-visible', 'hidden');
                save.hide();
                loader.resize = function () {
                    this.element.style.left = '10px';
                    this.element.style.top = d.documentElement.offsetHeight-loader.element.offsetHeight-13+'px';
                };
                loader.show();
                for (var x in userseditor.box) {
                    if (userseditor.box[x] && userseditor.box[x].input) {
                        var value = userseditor.box[x].input.value;
                        userseditor.data[x] = value === '' ? undefined : value === 'true' ? true : value === 'false' ? false : !isNaN(value) ? Number(value) : value;
                    }
                }
                probes[0].pass({
                    name: userseditor.data.name,
                    auth: userseditor.data.auth
                });
                setTimeout(function () {
                    save.element.className = 'btn small';
                }, 100);
            }
        }
    }
};
CodeMirror.commands.save = function () {
    "use strict";
    save.element.onclick();
};

var restart = alien.button("Kill process");
restart.element.style.left = save.element.offsetLeft+save.element.offsetWidth+10+'px';
restart.element.onclick = function () {
    "use strict";
    if (this.className !== 'btn pressed small') {
        this.className = 'btn pressed small';
        probes[0].restart();
    }
};

var errmsg = alien.error();

var actionbox = alien.group([run, save, restart, errmsg]);
actionbox.element.style.left = '10px';
actionbox.element.style.height = run.element.offsetHeight+'px';
actionbox.resize = function () {
    "use strict";
    this.element.style.top = d.documentElement.offsetHeight-this.element.offsetHeight-13+'px';
    this.element.style.width = d.documentElement.offsetWidth-this.element.offsetLeft-10+'px';
    errmsg.element.style.left = (
        restart.element.getAttribute('data-visible') !== 'hidden' ? restart.element.offsetLeft+restart.element.offsetWidth+10 :
        save.element.getAttribute('data-visible') !== 'hidden' ? save.element.offsetLeft+save.element.offsetWidth+10 :
        0
    )+'px';
    errmsg.element.style.width = d.documentElement.offsetWidth-errmsg.element.offsetLeft-20+'px';
};
interfaces.actionbox = actionbox;

pages[1] = interfaces;


var resize = function () {
    "use strict";
    for (var x in pages[page]) pages[page][x].resize();
    if (loader.resize) loader.resize();
    if (noghost.resize) noghost.resize();
    if (infobox) infobox.resize();
};
window.onresize = window.onload = resize;
window.onbeforeunload = function () {
    "use strict";
    socket.close();
};
window.onkeydown = function (e) {
    "use strict";
    if (e.keyCode === 27) {
        if (infoboxes.length) {
            if (infoboxes.length === 1) {
                infobox.element.setAttribute('data-visible', 'hidden');
                infobox.hide();
                listeditor.editor.focus();
                infobox.element.parentNode.removeChild(infobox.element);
                infobox = null;
                infoboxes = [];
            } else {
                infoboxes.shift();
                infobox.element.parentNode.removeChild(infobox.element);
                infobox = infoboxes[0];
                infobox.element.setAttribute('data-visible', 'visible');
                infobox.show();
            }
        }
        if (probes[0].view.list !== false) {
            CodeMirror.commands.clearSearch(listeditor.editor);
        } else if (probes[0].view.lists) {
            CodeMirror.commands.clearSearch(listslist.editor);
        } else if (probes[0].view.files !== false) {
            CodeMirror.commands.clearSearch(fileslist.editor);
            CodeMirror.commands.clearSearch(fileseditor.editor);
        } else if (probes[0].view.users) {
            CodeMirror.commands.clearSearch(userslist.editor);
        }
    }
};
