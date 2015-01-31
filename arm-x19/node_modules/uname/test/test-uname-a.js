var mod_uname = require('../build/Release/binding.node');
var mod_cp = require('child_process');
var ASSERT = require('assert');

var uts = mod_uname.uname();
var fields = {
	sysname: "-s",
	nodename: "-n",
	release: "-r",
	version: "-v",
	machine: "-m"
};

var field, nfields;

for (field in uts)
	ASSERT.ok(field in fields);

nfields = 0;
for (field in fields) {
	nfields++;
	check(field);
}

function check(field)
{
	var exec = 'uname ' + fields[field];

	mod_cp.exec(exec, function (err, stdout, stderr) {
		var value;

		console.log('checking field "%s" with %s', field, exec);
		ASSERT.ok(err === null, 'invocation failed');

		/* Chop trailing newline. */
		value = stdout.substring(0, stdout.length - 1);
		console.log('expected output: "%s"', value);
		console.log('actual output: "%s"', uts[field]);
		ASSERT.ok(value === uts[field], 'value mismatch');
	});
}
