node-uname
==============

Overview
--------

node-uname is a node.js addon that exposes the standard uname function as
defined by IEEE Std 1003.1-2001 incorporated into the Single Unix Specification
v3.  The uname function allows software to identify information about the
currently running system software.  This information is useful primarily for
identification purposes but also as a last resort in determining what
capabilities are supported by a particular system.  Where possible, software
should test for the presence of specific features rather than hardcode which
system releases support those features.


Platforms
---------

This should work on any platform that implements the "uname" function as
described by the Single Unix Specification version 3.  It is known to work on
Mac OS X (tested on 10.6.5) and OpenSolaris build 147.


Installation
------------

As a module, node-uname is installed in the usual way:

      $ npm install uname


API
---

### `uname.uname()`

Returns an object with string members corresponding to the fields of `struct
utsinfo` as described by the standard.  For convenience, these are described
here:

	sysname		Name of this implementation of the operating system. 
	nodename	Name of this node within the communications network to
			which this node is attached, if any. 
	release  	Current release level of this implementation. 
	version  	Current version level of this release. 
	machine  	Name of the hardware type on which the system is running. 

This function generally cannot fail except in truly exceptional circumstances
(like insufficient space to allocate the return value).


Example
--------

### Reimplementing "uname -s" (see uname(1))

      var uname = require('uname');
      var utsname = uname.uname();
      console.log(utsname.sysname);
