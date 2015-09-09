/**
 * Headless config.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */
exports.ip = '0.0.0.0';
exports.http = 36665;
exports.https = 36669;
exports.proxied = false;
// Keep-alive every 4 minutes, must be under websocket 5 minute timeout
exports.heartbeat = 240000;
// Stream throttling rate, in bytes per second
exports.streamrate = 51200;
// Optional restart command
//exports.restart = '/etc/init.d/headless.sh restart';
// Optional phantomjs path
//exports.phantomjs = 'bin/phantomjs';
// Optional git path
//exports.git = '/opt/bin/git';
