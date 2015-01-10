/**
 * Headless phantom file utilities.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, phantom:true, indent:4
*/

if (typeof phantom === 'undefined') {
    console.error("Headless shell needs to be executed from mothership");
}

var Shell = function () {};
utils.inherits(Shell, require('../shell').constructor);

Shell.prototype.path = fs.workingDirectory;
Shell.prototype.separator = fs.separator;

/**
 * Path basename.
 *
 * @param    {string} p Path
 * @param    {undefined|string} [ext] Extension
 * @returns  {string}
 */
function basename(p, ext) {
    "use strict";
    var str = p.replace(/\\/g, '/').replace(/.*\//, '');
    return ext ? str.replace(new RegExp(ext+'$'), '') : str;
}

/**
 * Path dirname.
 *
 * @param    {string} p Path
 * @returns  {string}
 */
function dirname(p) {
    "use strict";
    return p.replace(/\\/g, '/').replace(/\/[^\/]*$/, '');
}
Shell.prototype.dirname = dirname;

/**
 * Path join.
 *
 * @param    {...string} arguments
 * @returns  {string}
 */
function join() {
    "use strict";
    return Array.prototype.join.call(arguments, fs.separator);
}
Shell.prototype.join = join;

/**
 * Check if path exists.
 *
 * @param    {string} filepath
 * @returns  {boolean}
 */
function exists(filepath) {
    "use strict";
    return fs.exists(filepath);
}
Shell.prototype.exists = exists;

/**
 * Read file.
 *
 * @param    {string} filename
 * @returns  {Object}
 */
function read(filename) {
    "use strict";
    return fs.read(filename);
}
Shell.prototype.read = read;

/**
 * Read directory.
 *
 * @param    {string} dir Path
 * @returns  {string[]}
 */
function readdir(dir) {
    "use strict";
    return fs.list(dir);
}
Shell.prototype.readdir = readdir;

/**
 * Read directory and sub-directories.
 *
 * @param    {string} dir Path
 * @param    {undefined|string[]} paths Path list
 * @returns  {string[]}
 */
function files(dir, paths) {
    "use strict";
    if (typeof paths === 'undefined') paths = [];
    var filenames = readdir(dir);
    filenames.sort(function (a, b) {
        return a < b ? -1 : 1;
    });
    filenames.forEach(function (file) {
        var fullpath = Shell.prototype.join(dir, file);
        if (fs.isDirectory(fullpath)) {
            files(fullpath, paths);
        } else {
            paths.push(fullpath);
        }
    });
    return paths;
}
Shell.prototype.files = files;

/**
 * Read directory of JSON lists.
 *
 * @param    {string} dir Path
 * @returns  {string[]}
 */
function lists(dir) {
    "use strict";
    var paths = [],
        filenames = readdir(dir);
    filenames.sort(function (a, b) {
        return a < b ? -1 : 1;
    });
    filenames.forEach(function (file) {
        var fullpath = Shell.prototype.join(dir, file);
        if (!/\.json$/.test(fullpath)) return;
        try {
            paths.push({
                path: fullpath,
                list: JSON.parse(read(fullpath))
            });
        } catch (err) {
            var match = (new RegExp('\\('+shell.path+'\/(.*):(.*):(.*)\\)', 'i')).exec(err.stack);
            if (match) error = {
                path: fullpath,
                line: 0,
                ch: 0,
                message: err.message,
                stack: err.stack
            };
        }
    });
    return paths;
}
Shell.prototype.lists = lists;

/**
 * Move path.
 *
 * @param    {string} src Path
 * @param    {string} dest Path
 * @returns  {Object}
 */
function move(src, dest) {
    "use strict";
    return fs.move(src, dest);
}
Shell.prototype.move = move;

/**
 * Write file.
 *
 * @param    {string} filename
 * @param    {string} data
 * @returns  {Object}
 */
function write(filename, data) {
    "use strict";
    return fs.write(filename, data, 'w');
}
Shell.prototype.write = write;

/**
 * Make directory recursively equivalent of `mkdir -p`.
 *
 * @param    {string} dir Path
 */
function mkdir(dir) {
    "use strict";
    fs.makeTree(dir);
}
Shell.prototype.mkdir = mkdir;

/**
 * Copy directory recursively equivalent of `cp -R`.
 *
 * @param    {string} src Path
 * @param    {string} dest Path
 */
function cpdir(src, dest) {
    "use strict";
    fs.copyTree(src, dest);
}
Shell.prototype.cpdir = cpdir;

/**
 * Remove directory recursively equivalent of `rm -Rf`.
 *
 * @param    {string} dir Path
 * @param    {undefined|boolean} [empty] Remove empty directory tree
 */
function rmdir(dir, empty) {
    "use strict";
    fs.removeTree(dir);
    if (empty) rmdirEmpty(dir);
}
Shell.prototype.rmdir = rmdir;

/**
 * Remove empty directory tree.
 *
 * @param    {string} dir Path
 */
function rmdirEmpty(dir) {
    "use strict";
    var parts = dir.split(fs.separator);
    for (var i = parts.length; i > 0; i--) {
        var fullpath = parts.slice(0, i).join(fs.separator);
        if (readdir(fullpath).length) break;
        fs.removeDirectory(fullpath);
    }
}
Shell.prototype.rmdirEmpty = rmdirEmpty;

module.exports = exports = new Shell();
