(function() {
  var Data, DataProcess, backendProcess, calculateMeta, calculateStats, filterFactory, filters, frontendProcess, poly, statistics, statsFactory, transformFactory, transforms,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  poly = this.poly || {};

  /*
  # GLOBALS
  */

  /*
  Generalized data object that either contains JSON format of a dataset,
  or knows how to retrieve data from some source.
  */

  Data = (function() {

    function Data(params) {
      this.url = params.url, this.json = params.json, this.csv = params.csv, this.meta = params.meta;
      this.dataBackend = params.url != null;
      this.computeBackend = false;
      this.raw = null;
      if (this.meta == null) this.meta = {};
      this.subscribed = [];
    }

    Data.prototype.impute = function(json) {
      var first100, item, key, keys, _base, _i, _j, _k, _len, _len2, _len3;
      keys = _.keys(json[0]);
      first100 = json.slice(0, 100);
      for (_i = 0, _len = keys.length; _i < _len; _i++) {
        key = keys[_i];
        if ((_base = this.meta)[key] == null) _base[key] = {};
        if (!this.meta[key].type) {
          this.meta[key].type = poly.typeOf(_.pluck(first100, key));
        }
      }
      for (_j = 0, _len2 = json.length; _j < _len2; _j++) {
        item = json[_j];
        for (_k = 0, _len3 = keys.length; _k < _len3; _k++) {
          key = keys[_k];
          item[key] = poly.parse(item[key], this.meta[key]);
        }
      }
      return this.raw = json;
    };

    Data.prototype.getRaw = function(callback) {
      var _this = this;
      if (this.json) this.raw = this.impute(this.json);
      if (this.csv) this.raw = this.impute(poly.csv.parse(this.csv));
      if (this.raw) return callback(this.raw);
      if (this.url) {
        return poly.csv(this.url, function(csv) {
          _this.raw = _this.impute(csv);
          return callback(_this.raw);
        });
      }
    };

    Data.prototype.update = function(params) {
      var _this = this;
      this.json = params.json, this.csv = params.csv;
      return this.getRaw(function() {
        var fn, _i, _len, _ref, _results;
        _ref = _this.subscribed;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          fn = _ref[_i];
          _results.push(fn());
        }
        return _results;
      });
    };

    Data.prototype.subscribe = function(h) {
      if (_.indexOf(this.subscribed, h) === -1) return this.subscribed.push(h);
    };

    Data.prototype.unsubscribe = function(h) {
      return this.subscribed.splice(_.indexOf(this.subscribed, h), 1);
    };

    return Data;

  })();

  poly.Data = Data;

  /*
  Wrapper around the data processing piece that keeps track of the kind of
  data processing to be done.
  */

  DataProcess = (function() {

    function DataProcess(layerSpec, strictmode) {
      this._wrap = __bind(this._wrap, this);      this.dataObj = layerSpec.data;
      this.initialSpec = poly.spec.layerToData(layerSpec);
      this.prevSpec = null;
      this.strictmode = strictmode;
      this.statData = null;
      this.metaData = {};
    }

    DataProcess.prototype.reset = function(callback) {
      return this.make(this.initialSpec, callback);
    };

    DataProcess.prototype.make = function(spec, callback) {
      var dataSpec, wrappedCallback;
      dataSpec = poly.spec.layerToData(spec);
      wrappedCallback = this._wrap(callback);
      if (this.strictmode) wrappedCallback(this.dataObj.json, {});
      if (this.dataObj.computeBackend) {
        return backendProcess(dataSpec, this.dataObj, wrappedCallback);
      } else if (this.dataObj.dataBackend) {
        return this.dataObj.getRaw(function(json) {
          return frontendProcess(dataSpec, json, wrappedCallback);
        });
      } else {
        return frontendProcess(dataSpec, this.dataObj.json, wrappedCallback);
      }
    };

    DataProcess.prototype._wrap = function(callback) {
      var _this = this;
      return function(data, metaData) {
        _this.statData = data;
        _this.metaData = metaData;
        return callback(_this.statData, _this.metaData);
      };
    };

    return DataProcess;

  })();

  poly.DataProcess = DataProcess;

  /*
  Temporary
  */

  poly.data = {};

  poly.data.process = function(dataObj, layerSpec, strictmode, callback) {
    var d;
    d = new DataProcess(layerSpec, strictmode);
    d.process(callback);
    return d;
  };

  /*
  TRANSFORMS
  ----------
  Key:value pair of available transformations to a function that creates that
  transformation. Also, a metadata description of the transformation is returned
  when appropriate. (e.g for binning)
  */

  transforms = {
    'bin': function(key, transSpec) {
      var binFn, binwidth, name;
      name = transSpec.name, binwidth = transSpec.binwidth;
      if (!isNaN(binwidth)) {
        binwidth = +binwidth;
        binFn = function(item) {
          return item[name] = binwidth * Math.floor(item[key] / binwidth);
        };
        return {
          trans: binFn,
          meta: {
            bw: binwidth,
            binned: true
          }
        };
      }
    },
    'lag': function(key, transSpec) {
      var i, lag, lagFn, lastn, name;
      name = transSpec.name, lag = transSpec.lag;
      lastn = (function() {
        var _results;
        _results = [];
        for (i = 1; 1 <= lag ? i <= lag : i >= lag; 1 <= lag ? i++ : i--) {
          _results.push(void 0);
        }
        return _results;
      })();
      lagFn = function(item) {
        lastn.push(item[key]);
        return item[name] = lastn.shift();
      };
      return {
        trans: lagFn,
        meta: void 0
      };
    }
  };

  /*
  Helper function to figures out which transformation to create, then creates it
  */

  transformFactory = function(key, transSpec) {
    return transforms[transSpec.trans](key, transSpec);
  };

  /*
  FILTERS
  ----------
  Key:value pair of available filtering operations to filtering function. The
  filtering function returns true iff the data item satisfies the filtering
  criteria.
  */

  filters = {
    'lt': function(x, value) {
      return x < value;
    },
    'le': function(x, value) {
      return x <= value;
    },
    'gt': function(x, value) {
      return x > value;
    },
    'ge': function(x, value) {
      return x >= value;
    },
    'in': function(x, value) {
      return __indexOf.call(value, x) >= 0;
    }
  };

  /*
  Helper function to figures out which filter to create, then creates it
  */

  filterFactory = function(filterSpec) {
    var filterFuncs;
    filterFuncs = [];
    _.each(filterSpec, function(spec, key) {
      return _.each(spec, function(value, predicate) {
        var filter;
        filter = function(item) {
          return filters[predicate](item[key], value);
        };
        return filterFuncs.push(filter);
      });
    });
    return function(item) {
      var f, _i, _len;
      for (_i = 0, _len = filterFuncs.length; _i < _len; _i++) {
        f = filterFuncs[_i];
        if (!f(item)) return false;
      }
      return true;
    };
  };

  /*
  STATISTICS
  ----------
  Key:value pair of available statistics operations to a function that creates
  the appropriate statistical function given the spec. Each statistics function
  produces one atomic value for each group of data.
  */

  statistics = {
    sum: function(spec) {
      return function(values) {
        return _.reduce(_.without(values, void 0, null), (function(v, m) {
          return v + m;
        }), 0);
      };
    },
    count: function(spec) {
      return function(values) {
        return _.without(values, void 0, null).length;
      };
    },
    uniq: function(spec) {
      return function(values) {
        return (_.uniq(_.without(values, void 0, null))).length;
      };
    },
    min: function(spec) {
      return function(values) {
        return _.min(values);
      };
    },
    max: function(spec) {
      return function(values) {
        return _.max(values);
      };
    },
    median: function(spec) {
      return function(values) {
        return poly.median(values);
      };
    },
    box: function(spec) {
      return function(values) {
        var iqr, len, lowerBound, mid, q2, q4, quarter, sortedValues, splitValues, upperBound, _ref;
        len = values.length;
        mid = len / 2;
        sortedValues = _.sortBy(values, function(x) {
          return x;
        });
        quarter = Math.ceil(mid) / 2;
        if (quarter % 1 !== 0) {
          quarter = Math.floor(quarter);
          q2 = sortedValues[quarter];
          q4 = sortedValues[(len - 1) - quarter];
        } else {
          q2 = (sortedValues[quarter] + sortedValues[quarter - 1]) / 2;
          q4 = (sortedValues[len - quarter] + sortedValues[(len - quarter) - 1]) / 2;
        }
        iqr = q4 - q2;
        lowerBound = q2 - (1.5 * iqr);
        upperBound = q4 + (1.5 * iqr);
        splitValues = _.groupBy(sortedValues, function(v) {
          return v >= lowerBound && v <= upperBound;
        });
        return {
          q1: _.min(splitValues["true"]),
          q2: q2,
          q3: poly.median(sortedValues, true),
          q4: q4,
          q5: _.max(splitValues["true"]),
          outliers: (_ref = splitValues["false"]) != null ? _ref : []
        };
      };
    }
  };

  /*
  Helper function to figures out which statistics to create, then creates it
  */

  statsFactory = function(statSpec) {
    return statistics[statSpec.stat](statSpec);
  };

  /*
  Calculate statistics
  */

  calculateStats = function(data, statSpecs) {
    var groupedData, statFuncs;
    statFuncs = {};
    _.each(statSpecs.stats, function(statSpec) {
      var key, name, statFn;
      key = statSpec.key, name = statSpec.name;
      statFn = statsFactory(statSpec);
      return statFuncs[name] = function(data) {
        return statFn(_.pluck(data, key));
      };
    });
    groupedData = poly.groupBy(data, statSpecs.groups);
    return _.map(groupedData, function(data) {
      var rep;
      rep = {};
      _.each(statSpecs.groups, function(g) {
        return rep[g] = data[0][g];
      });
      _.each(statFuncs, function(stats, name) {
        return rep[name] = stats(data);
      });
      return rep;
    });
  };

  /*
  META
  ----
  Calculations of meta properties including sorting and limiting based on the
  values of statistical calculations
  */

  calculateMeta = function(key, metaSpec, data) {
    var asc, comparator, limit, multiplier, sort, stat, statSpec, values;
    sort = metaSpec.sort, stat = metaSpec.stat, limit = metaSpec.limit, asc = metaSpec.asc;
    if (stat) {
      statSpec = {
        stats: [stat],
        groups: [key]
      };
      data = calculateStats(data, statSpec);
    }
    multiplier = asc ? 1 : -1;
    comparator = function(a, b) {
      if (a[sort] === b[sort]) return 0;
      if (a[sort] >= b[sort]) return 1 * multiplier;
      return -1 * multiplier;
    };
    data.sort(comparator);
    if (limit) data = data.slice(0, (limit - 1) + 1 || 9e9);
    values = _.uniq(_.pluck(data, key));
    return {
      meta: {
        levels: values,
        sorted: true
      },
      filter: {
        "in": values
      }
    };
  };

  /*
  GENERAL PROCESSING
  ------------------
  Coordinating the actual work being done
  */

  /*
  Perform the necessary computation in the front end
  */

  frontendProcess = function(dataSpec, rawData, callback) {
    var addMeta, additionalFilter, d, data, filter, key, meta, metaData, metaSpec, trans, transSpec, _i, _j, _len, _len2, _ref, _ref2, _ref3, _ref4;
    data = _.clone(rawData);
    metaData = {};
    addMeta = function(key, meta) {
      var _ref;
      return metaData[key] = _.extend((_ref = metaData[key]) != null ? _ref : {}, meta);
    };
    if (dataSpec.trans) {
      _ref = dataSpec.trans;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        transSpec = _ref[_i];
        key = transSpec.key;
        _ref2 = transformFactory(key, transSpec), trans = _ref2.trans, meta = _ref2.meta;
        for (_j = 0, _len2 = data.length; _j < _len2; _j++) {
          d = data[_j];
          trans(d);
        }
        addMeta(transSpec.name, meta);
      }
    }
    if (dataSpec.filter) data = _.filter(data, filterFactory(dataSpec.filter));
    if (dataSpec.meta) {
      additionalFilter = {};
      _ref3 = dataSpec.meta;
      for (key in _ref3) {
        metaSpec = _ref3[key];
        _ref4 = calculateMeta(key, metaSpec, data), meta = _ref4.meta, filter = _ref4.filter;
        additionalFilter[key] = filter;
        addMeta(key, meta);
      }
      data = _.filter(data, filterFactory(additionalFilter));
    }
    if (dataSpec.stats && dataSpec.stats.stats && dataSpec.stats.stats.length > 0) {
      data = calculateStats(data, dataSpec.stats);
    }
    return callback(data, metaData);
  };

  /*
  Perform the necessary computation in the backend
  */

  backendProcess = function(dataSpec, rawData, callback) {
    return console.log('backendProcess');
  };

  /*
  For debug purposes only
  */

  poly.data.frontendProcess = frontendProcess;

  /*
  # EXPORT
  */

  this.poly = poly;

}).call(this);
