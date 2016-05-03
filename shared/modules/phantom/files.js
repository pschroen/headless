/**
 * Headless phantom file utilities.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals fs, utils, shell, error:true */
"use strict";

if (typeof phantom === 'undefined') {
    console.error("Headless shell needs to be executed from a mothership");
}

var Shell = function () {};
utils.inherits(Shell, require('../shell').constructor);

Shell.prototype.path = fs.workingDirectory;
Shell.prototype.separator = fs.separator;

/**
 * Path dirname.
 *
 * @param    {string} p Path
 * @returns  {string}
 */
function dirname(p) {
    return p.replace(/\\/g, '/').replace(/\/[^\/]*$/, '');
}
Shell.prototype.dirname = dirname;

/**
 * Path basename.
 *
 * @param    {string} p Path
 * @param    {undefined|string} [ext] Extension
 * @returns  {string}
 */
function basename(p, ext) {
    var str = p.replace(/\\/g, '/').replace(/.*\//, '');
    return ext ? str.replace(new RegExp(ext+'$'), '') : str;
}

/**
 * Path extname.
 *
 * @param    {string} p Path
 * @returns  {string}
 */
function extname(p) {
    var str = p.split('.').pop();
    return str !== p ? '.'+str : '';
}
Shell.prototype.extname = extname;

/**
 * Path join.
 *
 * @param    {...string} arguments
 * @returns  {string}
 */
function join() {
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
    return fs.write(filename, data, 'w');
}
Shell.prototype.write = write;

/**
 * Make directory recursively equivalent of `mkdir -p`.
 *
 * @param    {string} dir Path
 */
function mkdir(dir) {
    fs.makeTree(dir);
}
Shell.prototype.mkdir = mkdir;

/**
 * Copy directory recursively equivalent of `cp -r`.
 *
 * @param    {string} src Path
 * @param    {string} dest Path
 */
function cpdir(src, dest) {
    fs.copyTree(src, dest);
}
Shell.prototype.cpdir = cpdir;

/**
 * Remove directory recursively equivalent of `rm -rf`.
 *
 * @param    {string} dir Path
 * @param    {undefined|boolean} [empty] Remove empty directory tree
 */
function rmdir(dir, empty) {
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
    var parts = dir.split(fs.separator);
    for (var i = parts.length; i > 0; i--) {
        var fullpath = parts.slice(0, i).join(fs.separator);
        if (readdir(fullpath).length) break;
        fs.removeDirectory(fullpath);
    }
}
Shell.prototype.rmdirEmpty = rmdirEmpty;

module.exports = exports = new Shell();
