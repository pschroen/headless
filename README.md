# Headless

Headless is a web 3.0 framework for managing Internet connected devices and scripting anything you can imagine with JavaScript.


## Installation

1. Install [Node.js](http://nodejs.org/) - >=0.6.x, essentially anywhere you can get Node working you can run Headless, embedded computers, NAS and TV devices.
1. Visit [https://headless.io/setup/](https://headless.io/setup/) with [Chrome](https://www.google.com/chrome/).

```sh
curl -O -L https://github.com/pschroen/headless/archive/stable.zip
unzip stable.zip
cd headless-stable
npm install
npm start
```

Return to the setup page, create your first user and happy scripting! :)


## Running Forever

```sh
[sudo] npm install forever -g
forever start headless.js
forever list
```


## Really running forever

For Linux-based systems add the following to your `/etc/rc.local` before the final `exit 0`.

```sh
# Headless
su - <user> -c "cd <install path> && forever start headless.js"
```


## Resources

* [The Wiki](https://github.com/pschroen/headless/wiki)
* [Contributing](https://github.com/pschroen/headless/wiki/Contributing)
* [Website](https://headless.io/)
* [Documentation](https://headless.io/docs/)
* [Shell scripts](https://github.com/pschroen/shell)
* [Twitter](https://twitter.com/HeadlessIO)


## Copyright & License

Copyright (c) 2014-2015 Patrick Schroen - Released under the [MIT License](LICENSE).
