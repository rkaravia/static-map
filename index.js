var queue = require('async.queue');
var RateLimiter = require('limiter').RateLimiter;

var DEFAULT_TILE_LOADER = function(url, callback) {
    var image = new Image();
    image.onload = function() {
        callback(image);
    };
    image.crossOrigin = 'anonymous';
    image.src = url;
}

function toPixelCoordinates(lon, lat, zoom, size) {
    var x = lon / 360 + 0.5;
    var y = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / (2 * Math.PI);
    return [x, y].map(function(coord) {
        return Math.round(size * Math.pow(2, zoom) * coord);
    });
}

function GetMapTask(options, canvas, lon, lat, zoom) {
    this.options = options;
    this.canvas = canvas;
    this.zoom = zoom;
    this.initBounds(lon, lat);
}

GetMapTask.prototype.initBounds = function(lon, lat) {
    var width = this.canvas.width;
    var height = this.canvas.height;
    var size = this.options.size;
    var center = toPixelCoordinates(lon, lat, this.zoom, size);
    var topLeft = [center[0] - width / 2, center[1] - height / 2];
    var bottomRight = [center[0] + width / 2, center[1] + height / 2];

    this.xyzBounds = {
        minX: Math.floor(topLeft[0] / size),
        maxX: Math.floor((bottomRight[0] - 1) / size),
        minY: Math.floor(topLeft[1] / size),
        maxY: Math.floor((bottomRight[1] - 1) / size)
    };

    this.offset = [this.xyzBounds.minX * size - topLeft[0], this.xyzBounds.minY * size - topLeft[1]];
};

GetMapTask.prototype.getTiles = function(callback) {
    var tileQueue = queue(this.getTile.bind(this), this.options.concurrency);

    var extent = Math.pow(2, this.zoom);
    var y0 = Math.max(0, this.xyzBounds.minY);
    var y1 = Math.min(extent - 1, this.xyzBounds.maxY);
    var tileCount = 0;
    for (var y = y0; y <= y1; y++) {
        for (var x = this.xyzBounds.minX; x <= this.xyzBounds.maxX; x++) {
            tileQueue.push({
                x: ((x % extent) + extent) % extent,
                y: y,
                offset: [
                    (x - this.xyzBounds.minX) * this.options.size + this.offset[0],
                    (y - this.xyzBounds.minY) * this.options.size + this.offset[1]
                ],
                urlTemplate: this.options.urls[tileCount % this.options.urls.length]
            });
            tileCount++;
        }
    }

    if (callback) {
        tileQueue.drain = function() {
            callback();
        };
    }
}

GetMapTask.prototype.getTile = function(tile, callback) {
    var tileLoader = this.options.tileLoader;
    var url = this.tileUrl(tile);
    var offset = tile.offset;
    var size = this.options.size;
    var drawImage = function(image) {
        if (image.width !== size || image.height !== size) {
            throw 'Unexpected image dimensions: ' + image.width + ' / ' + image.height;
        }
        context.drawImage(image, offset[0], offset[1], size, size);
        callback();
    }
    var context = this.canvas.getContext('2d');
    if (this.options.limiter) {
        this.options.limiter.removeTokens(1, function() {
            tileLoader(url, drawImage);
        });
    } else {
        tileLoader(url, drawImage);
    }
}

GetMapTask.prototype.tileUrl = function(tile) {
    var values = {
        x: tile.x,
        y: tile.y,
        z: this.zoom
    };
    return tile.urlTemplate.replace(/\{(\w)\}/g, function(_, key) {
        return values[key];
    });
}

function StaticMap(urls, options) {
    if (!(this instanceof StaticMap)) {
        return new StaticMap(urls, options);
    }
    options = options || {};
    this.options = {
        concurrency: options.concurrency || Number.POSITIVE_INFINITY,
        size: options.size || 256,
        tileLoader: options.tileLoader || DEFAULT_TILE_LOADER,
        urls: Array.isArray(urls) ? urls : [urls]
    };
    if (options.rateLimit) {
        this.options.limiter = new RateLimiter(options.rateLimit, 'second');
    }
}

StaticMap.prototype.getMap = function(canvas, lon, lat, zoom, callback) {
    new GetMapTask(this.options, canvas, lon, lat, zoom).getTiles(callback);
}

module.exports = StaticMap;
