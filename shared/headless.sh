#!/bin/sh
CONF=/etc/config/qpkg.conf
QPKG_NAME="Headless"
QPKG_ROOT=`/sbin/getcfg $QPKG_NAME Install_Path -f ${CONF}`

case "$1" in
  start)
    ENABLED=$(/sbin/getcfg $QPKG_NAME Enable -u -d FALSE -f $CONF)
    if [ "$ENABLED" != "TRUE" ]; then
      echo "$QPKG_NAME is disabled."
      exit 1
    fi
    $0 stop
    cd $QPKG_ROOT
    exec > headless.log 2>&1 < /dev/null
    /bin/grep -q "/opt/lib" /etc/ld.so.conf
    if [ $? != 0 ]; then
      echo "/opt/lib" >> /etc/ld.so.conf
    fi
    /sbin/ldconfig
    UPGRADE=$(/sbin/curl -sLk https://github.com/pschroen/headless/raw/stable/package.json|\
      bin/node -pe "\
      parseInt(JSON.parse(require('fs').readFileSync('/dev/stdin').toString()).version.replace(/\./g,''),10)>\
      parseInt(JSON.parse(require('fs').readFileSync('package.json').toString()).version.replace(/\./g,''),10)\
      ")
    if [ "$UPGRADE" = "true" ]; then
      echo "Upgrading to latest stable..."
      /sbin/curl -sLk https://github.com/pschroen/headless/archive/stable.tar.gz | /bin/tar -zx --strip=1 --overwrite --exclude='config.js' --exclude='shell/config.json'
      #sed -i "/\"phantomjs\":/d" package.json
      #npm install
      if [ -x shell/.git ]; then
        cd shell
        /opt/bin/git pull origin stable
        cd ..
      fi
      VERSION=$(bin/node -pe "JSON.parse(require('fs').readFileSync('package.json').toString()).version")
      echo "Upgrade to version $VERSION complete"
    fi
    [ -x /opt/bin/transmission-daemon ] && /opt/bin/transmission-daemon -w /share/Download
    bin/node headless 2>&1 < /dev/null &
    ;;

  stop)
    killall transmission-daemon
    killall node
    killall phantomjs
    ;;

  restart)
    $0 stop
    $0 start
    ;;

  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
esac

exit 0
