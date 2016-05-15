#!/bin/sh
UPGRADE=$(curl -s -L -k https://github.com/pschroen/headless/raw/stable/package.json|\
    node -pe "\
    parseInt(JSON.parse(require('fs').readFileSync('/dev/stdin').toString()).version.replace(/\./g,''),10)>\
    parseInt(JSON.parse(require('fs').readFileSync('package.json').toString()).version.replace(/\./g,''),10)\
    ")
if [ "$UPGRADE" = "true" ]; then
    echo "Upgrading to latest stable..."
    curl -s -O -L -k https://github.com/pschroen/headless/archive/stable.tar.gz
    tar xzf stable.tar.gz --overwrite --strip=1 --exclude='config.js' --exclude='shell/config.json'
    rm stable.tar.gz
    npm install
    cd shell
    git pull origin stable
    cd ..
    VERSION=$(node -pe "JSON.parse(require('fs').readFileSync('package.json').toString()).version")
    echo "Upgrade to version $VERSION complete"
fi

exit 0
