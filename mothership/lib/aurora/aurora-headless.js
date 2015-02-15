// Abducted from aurora-websocket
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  AV.HeadlessSource = (function(_super) {
    __extends(HeadlessSource, _super);

    function HeadlessSource() {
        this.open = true;
        this.list = new AV.BufferList();
        this.bytesLoaded = 0;
    }

    HeadlessSource.prototype.start = function() {
        return console.log("Patrick's testing");
    };

    HeadlessSource.prototype.pause = function() {
        return true;
    };

    HeadlessSource.prototype.reset = function() {
        return true;
    };

    HeadlessSource.prototype.buffer = function(data) {
        var buf = new AV.Buffer(new Uint8Array(data));
        this.bytesLoaded += buf.length;
        console.log(this.bytesLoaded);
        if (this.length) {
            this.emit('progress', this.bytesLoaded / this.length * 100);
        }
        this.list.append(buf);
        this.emit('data', buf);
    };

    return HeadlessSource;

  })(AV.EventEmitter);

  AV.Asset.fromHeadless = function() {
    var source;
    source = new AV.HeadlessSource();
    return new AV.Asset(source);
  };

  AV.Player.fromHeadless = function() {
    var asset;
    asset = AV.Asset.fromHeadless();
    return new AV.Player(asset);
  };

}).call(this);
