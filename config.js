/**
 * Headless config.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */
exports.ip = '0.0.0.0';
exports.http = 36665;
exports.https = 36669;
exports.proxied = false;
// Keep-alive every 4 minutes, must be under websocket 5 minute timeout
exports.heartbeat = 4*60*1000;
// Stream throttling rate, in bytes per second
exports.streamrate = 100*1024;
// Optional restart command
//exports.restart = '/etc/init.d/headless.sh restart';
// Optional phantom path
//exports.phantomPath = 'bin/phantomjs';
