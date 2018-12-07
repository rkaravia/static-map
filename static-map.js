(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.StaticMap = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{"async.queue":2,"limiter":10}],2:[function(require,module,exports){
'use strict';

var queue = require('async.util.queue');

module.exports = function (worker, concurrency) {
    return queue(function (items, cb) {
        worker(items[0], cb);
    }, concurrency, 1);
};

},{"async.util.queue":8}],3:[function(require,module,exports){
'use strict';

module.exports = function arrayEach(arr, iterator) {
    var index = -1;
    var length = arr.length;

    while (++index < length) {
        iterator(arr[index], index, arr);
    }
};

},{}],4:[function(require,module,exports){
'use strict';

module.exports = Array.isArray || function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

},{}],5:[function(require,module,exports){
'use strict';

module.exports = function map(arr, iterator) {
    var index = -1;
    var length = arr.length;
    var result = new Array(length);
    while (++index < length) result[index] = iterator(arr[index], index, arr);
    return result;
};

},{}],6:[function(require,module,exports){
'use strict';

module.exports = function noop () {};

},{}],7:[function(require,module,exports){
'use strict';

module.exports = function only_once(fn) {
    return function() {
        if (fn === null) throw new Error('Callback was already called.');
        fn.apply(this, arguments);
        fn = null;
    };
};

},{}],8:[function(require,module,exports){
'use strict';

var map = require('async.util.map');
var noop = require('async.util.noop');
var isArray = require('async.util.isarray');
var onlyOnce = require('async.util.onlyonce');
var arrayEach = require('async.util.arrayeach');
var setImmediate = require('async.util.setimmediate');

module.exports = function queue(worker, concurrency, payload) {
    if (concurrency == null)
        concurrency = 1;
    else if (concurrency === 0) {
        throw new Error('Concurrency must not be zero');
    }

    function _insert(q, data, pos, callback) {
        if (callback != null && typeof callback !== "function") {
            throw new Error("task callback must be a function");
        }
        q.started = true;
        if (!isArray(data)) {
            data = [data];
        }
        if (data.length === 0 && q.idle()) {
            // call drain immediately if there are no tasks
            return setImmediate(function() {
                q.drain();
            });
        }
        arrayEach(data, function(task) {
            var item = {
                data: task,
                callback: callback || noop
            };

            if (pos) {
                q.tasks.unshift(item);
            } else {
                q.tasks.push(item);
            }

            if (q.tasks.length === q.concurrency) {
                q.saturated();
            }
        });
        setImmediate(q.process);
    }

    function _next(q, tasks) {
        return function() {
            workers -= 1;

            var removed = false;
            var args = arguments;
            arrayEach(tasks, function(task) {
                arrayEach(workersList, function(worker, index) {
                    if (worker === task && !removed) {
                        workersList.splice(index, 1);
                        removed = true;
                    }
                });

                task.callback.apply(task, args);
            });
            if (q.tasks.length + workers === 0) {
                q.drain();
            }
            q.process();
        };
    }

    var workers = 0;
    var workersList = [];
    var q = {
        tasks: [],
        concurrency: concurrency,
        payload: payload,
        saturated: noop,
        empty: noop,
        drain: noop,
        started: false,
        paused: false,
        push: function(data, callback) {
            _insert(q, data, false, callback);
        },
        kill: function() {
            q.drain = noop;
            q.tasks = [];
        },
        unshift: function(data, callback) {
            _insert(q, data, true, callback);
        },
        process: function() {
            while (!q.paused && workers < q.concurrency && q.tasks.length) {

                var tasks = q.payload ?
                    q.tasks.splice(0, q.payload) :
                    q.tasks.splice(0, q.tasks.length);

                var data = map(tasks, function(task) {
                    return task.data;
                });

                if (q.tasks.length === 0) {
                    q.empty();
                }
                workers += 1;
                workersList.push(tasks[0]);
                var cb = onlyOnce(_next(q, tasks));
                worker(data, cb);
            }
        },
        length: function() {
            return q.tasks.length;
        },
        running: function() {
            return workers;
        },
        workersList: function() {
            return workersList;
        },
        idle: function() {
            return q.tasks.length + workers === 0;
        },
        pause: function() {
            q.paused = true;
        },
        resume: function() {
            if (q.paused === false) {
                return;
            }
            q.paused = false;
            var resumeCount = Math.min(q.concurrency, q.tasks.length);
            // Need to call q.process once per concurrent
            // worker to preserve full concurrency after pause
            for (var w = 1; w <= resumeCount; w++) {
                setImmediate(q.process);
            }
        }
    };
    return q;
};

},{"async.util.arrayeach":3,"async.util.isarray":4,"async.util.map":5,"async.util.noop":6,"async.util.onlyonce":7,"async.util.setimmediate":9}],9:[function(require,module,exports){
(function (setImmediate){
'use strict';

var _setImmediate = typeof setImmediate === 'function' && setImmediate;
var fallback = function(fn) {
    setTimeout(fn, 0);
};

module.exports = function setImmediate(fn) {
    // not a direct alias for IE10 compatibility
    return (_setImmediate || fallback)(fn);
};

}).call(this,require("timers").setImmediate)
},{"timers":15}],10:[function(require,module,exports){

exports.RateLimiter = require('./lib/rateLimiter');
exports.TokenBucket = require('./lib/tokenBucket');

},{"./lib/rateLimiter":12,"./lib/tokenBucket":13}],11:[function(require,module,exports){
(function (process){
var getMilliseconds = function() {
  if (typeof process !== 'undefined' && process.hrtime) {
    var hrtime = process.hrtime();
    var seconds = hrtime[0];
    var nanoseconds = hrtime[1];

    return seconds * 1e3 +  Math.floor(nanoseconds / 1e6);
  }

  return new Date().getTime();
}

module.exports = getMilliseconds;

}).call(this,require('_process'))
},{"_process":14}],12:[function(require,module,exports){
(function (process){
var TokenBucket = require('./tokenBucket');
var getMilliseconds = require('./clock');

/**
 * A generic rate limiter. Underneath the hood, this uses a token bucket plus
 * an additional check to limit how many tokens we can remove each interval.
 * @author John Hurliman <jhurliman@jhurliman.org>
 *
 * @param {Number} tokensPerInterval Maximum number of tokens that can be
 *  removed at any given moment and over the course of one interval.
 * @param {String|Number} interval The interval length in milliseconds, or as
 *  one of the following strings: 'second', 'minute', 'hour', day'.
 * @param {Boolean} fireImmediately Optional. Whether or not the callback
 *  will fire immediately when rate limiting is in effect (default is false).
 */
var RateLimiter = function(tokensPerInterval, interval, fireImmediately) {
  this.tokenBucket = new TokenBucket(tokensPerInterval, tokensPerInterval,
    interval, null);

  // Fill the token bucket to start
  this.tokenBucket.content = tokensPerInterval;

  this.curIntervalStart = getMilliseconds();
  this.tokensThisInterval = 0;
  this.fireImmediately = fireImmediately;
};

RateLimiter.prototype = {
  tokenBucket: null,
  curIntervalStart: 0,
  tokensThisInterval: 0,
  fireImmediately: false,

  /**
   * Remove the requested number of tokens and fire the given callback. If the
   * rate limiter contains enough tokens and we haven't spent too many tokens
   * in this interval already, this will happen immediately. Otherwise, the
   * removal and callback will happen when enough tokens become available.
   * @param {Number} count The number of tokens to remove.
   * @param {Function} callback(err, remainingTokens)
   * @returns {Boolean} True if the callback was fired immediately, otherwise
   *  false.
   */
  removeTokens: function(count, callback) {
    // Make sure the request isn't for more than we can handle
    if (count > this.tokenBucket.bucketSize) {
      process.nextTick(callback.bind(null, 'Requested tokens ' + count +
        ' exceeds maximum tokens per interval ' + this.tokenBucket.bucketSize,
        null));
      return false;
    }

    var self = this;
    var now = getMilliseconds();

    // Advance the current interval and reset the current interval token count
    // if needed
    if (now < this.curIntervalStart
      || now - this.curIntervalStart >= this.tokenBucket.interval) {
      this.curIntervalStart = now;
      this.tokensThisInterval = 0;
    }

    // If we don't have enough tokens left in this interval, wait until the
    // next interval
    if (count > this.tokenBucket.tokensPerInterval - this.tokensThisInterval) {
      if (this.fireImmediately) {
        process.nextTick(callback.bind(null, null, -1));
      } else {
        var waitInterval = Math.ceil(
          this.curIntervalStart + this.tokenBucket.interval - now);

        setTimeout(function() {
          self.tokenBucket.removeTokens(count, afterTokensRemoved);
        }, waitInterval);
      }
      return false;
    }

    // Remove the requested number of tokens from the token bucket
    return this.tokenBucket.removeTokens(count, afterTokensRemoved);

    function afterTokensRemoved(err, tokensRemaining) {
      if (err) return callback(err, null);

      self.tokensThisInterval += count;
      callback(null, tokensRemaining);
    }
  },

  /**
   * Attempt to remove the requested number of tokens and return immediately.
   * If the bucket (and any parent buckets) contains enough tokens and we
   * haven't spent too many tokens in this interval already, this will return
   * true. Otherwise, false is returned.
   * @param {Number} count The number of tokens to remove.
   * @param {Boolean} True if the tokens were successfully removed, otherwise
   *  false.
   */
  tryRemoveTokens: function(count) {
    // Make sure the request isn't for more than we can handle
    if (count > this.tokenBucket.bucketSize)
      return false;

    var now = getMilliseconds();

    // Advance the current interval and reset the current interval token count
    // if needed
    if (now < this.curIntervalStart
      || now - this.curIntervalStart >= this.tokenBucket.interval) {
      this.curIntervalStart = now;
      this.tokensThisInterval = 0;
    }

    // If we don't have enough tokens left in this interval, return false
    if (count > this.tokenBucket.tokensPerInterval - this.tokensThisInterval)
      return false;

    // Try to remove the requested number of tokens from the token bucket
    var removed = this.tokenBucket.tryRemoveTokens(count);
    if (removed) {
      this.tokensThisInterval += count;
    }
    return removed;
  },

  /**
   * Returns the number of tokens remaining in the TokenBucket.
   * @returns {Number} The number of tokens remaining.
   */
  getTokensRemaining: function () {
    this.tokenBucket.drip();
    return this.tokenBucket.content;
  }
};

module.exports = RateLimiter;

}).call(this,require('_process'))
},{"./clock":11,"./tokenBucket":13,"_process":14}],13:[function(require,module,exports){
(function (process){

/**
 * A hierarchical token bucket for rate limiting. See
 * http://en.wikipedia.org/wiki/Token_bucket for more information.
 * @author John Hurliman <jhurliman@cull.tv>
 *
 * @param {Number} bucketSize Maximum number of tokens to hold in the bucket.
 *  Also known as the burst rate.
 * @param {Number} tokensPerInterval Number of tokens to drip into the bucket
 *  over the course of one interval.
 * @param {String|Number} interval The interval length in milliseconds, or as
 *  one of the following strings: 'second', 'minute', 'hour', day'.
 * @param {TokenBucket} parentBucket Optional. A token bucket that will act as
 *  the parent of this bucket.
 */
var TokenBucket = function(bucketSize, tokensPerInterval, interval, parentBucket) {
  this.bucketSize = bucketSize;
  this.tokensPerInterval = tokensPerInterval;

  if (typeof interval === 'string') {
    switch (interval) {
      case 'sec': case 'second':
        this.interval = 1000; break;
      case 'min': case 'minute':
        this.interval = 1000 * 60; break;
      case 'hr': case 'hour':
        this.interval = 1000 * 60 * 60; break;
      case 'day':
        this.interval = 1000 * 60 * 60 * 24; break;
      default:
        throw new Error('Invaid interval ' + interval);
    }
  } else {
    this.interval = interval;
  }

  this.parentBucket = parentBucket;
  this.content = 0;
  this.lastDrip = +new Date();
};

TokenBucket.prototype = {
  bucketSize: 1,
  tokensPerInterval: 1,
  interval: 1000,
  parentBucket: null,
  content: 0,
  lastDrip: 0,

  /**
   * Remove the requested number of tokens and fire the given callback. If the
   * bucket (and any parent buckets) contains enough tokens this will happen
   * immediately. Otherwise, the removal and callback will happen when enough
   * tokens become available.
   * @param {Number} count The number of tokens to remove.
   * @param {Function} callback(err, remainingTokens)
   * @returns {Boolean} True if the callback was fired immediately, otherwise
   *  false.
   */
  removeTokens: function(count, callback) {
    var self = this;

    // Is this an infinite size bucket?
    if (!this.bucketSize) {
      process.nextTick(callback.bind(null, null, count, Number.POSITIVE_INFINITY));
      return true;
    }

    // Make sure the bucket can hold the requested number of tokens
    if (count > this.bucketSize) {
      process.nextTick(callback.bind(null, 'Requested tokens ' + count + ' exceeds bucket size ' +
        this.bucketSize, null));
      return false;
    }

    // Drip new tokens into this bucket
    this.drip();

    // If we don't have enough tokens in this bucket, come back later
    if (count > this.content)
      return comeBackLater();

    if (this.parentBucket) {
      // Remove the requested from the parent bucket first
      return this.parentBucket.removeTokens(count, function(err, remainingTokens) {
        if (err) return callback(err, null);

        // Check that we still have enough tokens in this bucket
        if (count > self.content)
          return comeBackLater();

        // Tokens were removed from the parent bucket, now remove them from
        // this bucket and fire the callback. Note that we look at the current
        // bucket and parent bucket's remaining tokens and return the smaller
        // of the two values
        self.content -= count;
        callback(null, Math.min(remainingTokens, self.content));
      });
    } else {
      // Remove the requested tokens from this bucket and fire the callback
      this.content -= count;
      process.nextTick(callback.bind(null, null, this.content));
      return true;
    }

    function comeBackLater() {
      // How long do we need to wait to make up the difference in tokens?
      var waitInterval = Math.ceil(
        (count - self.content) * (self.interval / self.tokensPerInterval));
      setTimeout(function() { self.removeTokens(count, callback); }, waitInterval);
      return false;
    }
  },

  /**
   * Attempt to remove the requested number of tokens and return immediately.
   * If the bucket (and any parent buckets) contains enough tokens this will
   * return true, otherwise false is returned.
   * @param {Number} count The number of tokens to remove.
   * @param {Boolean} True if the tokens were successfully removed, otherwise
   *  false.
   */
  tryRemoveTokens: function(count) {
    // Is this an infinite size bucket?
    if (!this.bucketSize)
      return true;

    // Make sure the bucket can hold the requested number of tokens
    if (count > this.bucketSize)
      return false;

    // Drip new tokens into this bucket
    this.drip();

    // If we don't have enough tokens in this bucket, return false
    if (count > this.content)
      return false;

    // Try to remove the requested tokens from the parent bucket
    if (this.parentBucket && !this.parent.tryRemoveTokens(count))
      return false;

    // Remove the requested tokens from this bucket and return
    this.content -= count;
    return true;
  },

  /**
   * Add any new tokens to the bucket since the last drip.
   * @returns {Boolean} True if new tokens were added, otherwise false.
   */
  drip: function() {
    if (!this.tokensPerInterval) {
      this.content = this.bucketSize;
      return;
    }

    var now = +new Date();
    var deltaMS = Math.max(now - this.lastDrip, 0);
    this.lastDrip = now;

    var dripAmount = deltaMS * (this.tokensPerInterval / this.interval);
    this.content = Math.min(this.content + dripAmount, this.bucketSize);
  }
};

module.exports = TokenBucket;

}).call(this,require('_process'))
},{"_process":14}],14:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],15:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":14,"timers":15}]},{},[1])(1)
});
