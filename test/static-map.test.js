var test = require('tape');

var stubImage = {
    width: 256,
    height: 256
};

var StaticMap = require('../index.js');

function StubTileLoader() {
    var stub = {
        urls: []
    };

    stub.tileLoader = function(url, callback) {
        stub.urls.push(url);
        callback(stubImage);
    }

    return stub;
}

function StubCanvas(width, height) {
    var stub = {
        drawImageCalls: []
    };

    stub.canvas = {
        width: width,
        height: height,
        getContext: function() {
            return {
                drawImage: function(image, x, y, width, height) {
                    stub.drawImageCalls.push([x, y, width, height]);
                }
            }
        }
    };

    return stub;
}

test('tile URLs', function(t) {
    var loader = StubTileLoader();
    var staticMap = StaticMap('https://example.com/{z}/{x}/{y}.png', {
        tileLoader: loader.tileLoader
    });
    var stubCanvas = StubCanvas(256, 256);
    var lon = 7.438639;
    var lat = 46.951083;
    var zoom = 15;
    staticMap.getMap(stubCanvas.canvas, lon, lat, zoom, function() {
        t.deepEqual(loader.urls, [
            'https://example.com/15/17060/11531.png',
            'https://example.com/15/17061/11531.png',
            'https://example.com/15/17060/11532.png',
            'https://example.com/15/17061/11532.png'
        ]);
        t.deepEqual(stubCanvas.drawImageCalls, [
            [-149, -100, 256, 256],
            [107, -100, 256, 256],
            [-149, 156, 256, 256],
            [107, 156, 256, 256]
        ]);
        t.end();
    });
});

test('tile URLs (cross meridian)', function(t) {
    var loader = StubTileLoader();
    var staticMap = StaticMap('https://example.com/{z}/{x}/{y}.png', {
        tileLoader: loader.tileLoader
    });
    var stubCanvas = StubCanvas(512, 512);
    var lon = 180;
    var lat = 0;
    var zoom = 5;
    staticMap.getMap(stubCanvas.canvas, lon, lat, zoom, function() {
        t.deepEqual(loader.urls, [
            'https://example.com/5/31/15.png',
            'https://example.com/5/0/15.png',
            'https://example.com/5/31/16.png',
            'https://example.com/5/0/16.png'
        ]);
        t.deepEqual(stubCanvas.drawImageCalls, [
            [0, 0, 256, 256],
            [256, 0, 256, 256],
            [0, 256, 256, 256],
            [256, 256, 256, 256]
        ]);
        t.end();
    });
});

test('tile URLs (north and south bounds)', function(t) {
    var loader = StubTileLoader();
    var staticMap = StaticMap('https://example.com/{z}/{x}/{y}.png', {
        tileLoader: loader.tileLoader
    });
    var stubCanvas = StubCanvas(256, 4096);
    var lon = 90;
    var lat = 0;
    var zoom = 1;
    staticMap.getMap(stubCanvas.canvas, lon, lat, zoom, function() {
        t.deepEqual(loader.urls, [
            'https://example.com/1/1/0.png',
            'https://example.com/1/1/1.png'
        ]);
        t.end();
    });
});

test('tile URL subdomains', function(t) {
    var loader = StubTileLoader();
    var staticMap = StaticMap([
        'https://a.example.com/{z}/{x}/{y}.png',
        'https://b.example.com/{z}/{x}/{y}.png',
        'https://c.example.com/{z}/{x}/{y}.png',
    ], {
        tileLoader: loader.tileLoader
    });
    var stubCanvas = StubCanvas(256, 256);
    var lon = 7.438639;
    var lat = 46.951083;
    var zoom = 5;
    staticMap.getMap(stubCanvas.canvas, lon, lat, zoom, function() {
        t.deepEqual(loader.urls, [
            'https://a.example.com/5/16/10.png',
            'https://b.example.com/5/17/10.png',
            'https://c.example.com/5/16/11.png',
            'https://a.example.com/5/17/11.png'
        ]);
        t.end();
    });
});
