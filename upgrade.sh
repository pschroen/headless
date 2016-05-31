#!/bin/sh
UPGRADE=$(curl -sLk https://github.com/pschroen/headless/raw/stable/package.json|\
    node -pe "\
    parseInt(JSON.parse(require('fs').readFileSync('/dev/stdin').toString()).version.replace(/\./g,''),10)>\
    parseInt(JSON.parse(require('fs').readFileSync('package.json').toString()).version.replace(/\./g,''),10)\
    ")
if [ "$UPGRADE" = "true" ]; then
    echo "Upgrading to latest stable..."
    curl -sLk https://github.com/pschroen/headless/archive/stable.tar.gz | tar -zx --strip=1 --overwrite --exclude='config.js' --exclude='shell/config.json'
    npm install
    if [ -x shell/.git ]; then
        cd shell
        git pull origin stable
        cd ..
    fi
    chown -R headless:headless .
    VERSION=$(node -pe "JSON.parse(require('fs').readFileSync('package.json').toString()).version")
    echo "Upgrade to version $VERSION complete"
fi

exit 0
