# static-map

Render map tiles in a canvas, given a [slippy map tile URL](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames).

## Demo

The [demo](https://rzoller.ch/static-map) renders 512x512px of [OpenStreetMap](https://www.openstreetmap.org/).

## Install

```
$ npm install @rz0/static-map
```

## Usage

```javascript
var canvas = document.createElement('canvas');
document.body.appendChild(canvas)
canvas.width = 512;
canvas.height = 512;

var url = 'https://example.com/{z}/{x}/{y}.png';
var lon = 7.438639;
var lat = 46.951083;
var zoom = 15;
var staticMap = StaticMap(url);
staticMap.getMap(canvas, lon, lat, zoom);
```

## See also

- [BigMap 2](http://bigmap.osmz.ru/)
- [leaflet-image](https://github.com/mapbox/leaflet-image)
