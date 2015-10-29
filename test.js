'use strict';
var test = require('tape');
var intoCartodb = require('./');
var auth = require('./auth.json');
var cartodb = require('cartodb-tools')(auth.user, auth.key);
var crypto = require('crypto');
test('crud', function (t) {
  var table = 'test_table_into_carto' + crypto.randomBytes(8).toString('hex');
  var tablewithDash = 'test-table_into_carto' + crypto.randomBytes(8).toString('hex');
  var tablewithOutDash = tablewithDash.replace(/-/g, '_');
  t.test('maybe delete', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(table).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('append to nonexistant table', function (t) {
    t.plan(1);
    intoCartodb(auth.user, auth.key, table, 'append', function (err) {
      t.ok(err, 'should error');
    });
  });
  t.test('replace to nonexistant table', function (t) {
    t.plan(1);
    intoCartodb(auth.user, auth.key, table, 'replace', function (err) {
      t.ok(err, 'should error');
    });
  });
  t.test('create', function (t) {
    var inserted = 0;
    var stream = intoCartodb(auth.user, auth.key, table, function (err) {
      t.error(err, 'no error');
      t.equals(inserted, 160);
      cartodb(table).select().where('foo_blahoela', 'foo_blahoela').where('_as', '_as').where('fooo', 'fooo').exec(function (err, resp) {
        t.error(err, 'no error');
        t.equals(resp.length, 160);
        t.end();
      });
    });
    stream.on('inserted', function (num) {
      t.ok(true, 'inserted');
      inserted += num;
    });
    var i = -1;
    while (++i < 160) {
      stream.write({
        type: 'Feature',
        properties: {
          num: i,
          1: 1,
          'foo.blahœla': 'foo_blahoela',
          '<foo>as': '_as',
          '?#fooo': 'fooo'
          },
        geometry: null
      });
    }
    stream.end();
  });
  t.test('create again', function (t) {
    t.plan(1);
    intoCartodb(auth.user, auth.key, table, function (err) {
      t.ok(err, 'should error');
    });
  });
  t.test('correct ammount', function (t) {
    t.plan(2);
    cartodb(table).count('num').exec(function (err, resp) {
      t.error(err);
      t.deepEquals(resp, [{count: 160}]);
    });
  });
  t.test('append', function (t) {
    var inserted = 0;
    var stream = intoCartodb(auth.user, auth.key, table, 'append', function (err) {
      t.error(err, 'no error');
      t.equals(inserted, 230);
      t.end();
    });
    stream.on('inserted', function (num) {
      t.ok(true, 'inserted');
      inserted += num;
    });
    var i = -1;
    while (++i < 230) {
      stream.write({
        type: 'Feature',
        properties: {
          num: i
        },
        geometry: null
      });
    }
    stream.end();
  });
  t.test('correct ammount round 2', function (t) {
    t.plan(2);
    cartodb(table).count('num').exec(function (err, resp) {
      t.error(err);
      t.deepEquals(resp, [{count: 390}]);
    });
  });
  t.test('replace', function (t) {
    var inserted = 0;
    t.plan(2);
    var stream = intoCartodb(auth.user, auth.key, table, 'replace', function (err) {
      t.error(err, 'no error');
      t.equals(inserted, 75);
    });
    stream.on('inserted', function (num) {
      inserted += num;
    });
    var i = -1;
    while (++i < 75) {
      stream.write({
        type: 'Feature',
        properties: {
          num: i
        },
        geometry: null
      });
    }
    stream.end();
  });
  t.test('correct ammount round 3', function (t) {
    t.plan(2);
    cartodb(table).count('num').exec(function (err, resp) {
      t.error(err);
      t.deepEquals(resp, [{count: 75}]);
    });
  });
  t.test('maybe delete again', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(table).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('create less then 50', function (t) {
    var inserted = 0;
    t.plan(4);
    var stream = intoCartodb(auth.user, auth.key, table, function (err) {
      t.error(err, 'no error');
      t.equals(inserted, 40);
      cartodb(table).count('num').exec(function (err, resp) {
        t.error(err);
        t.deepEquals(resp, [{count: 40}]);
      });
    });
    stream.on('inserted', function (num) {
      inserted += num;
    });
    var i = -1;
    while (++i < 40) {
      stream.write({
        type: 'Feature',
        properties: {
          num: i
        },
        geometry: {
          type: 'Point',
          coordinates: [i, i]
        }
      });
    }
    stream.end();
  });
  t.test('maybe delete', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(table).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('test validations', function (t) {
    t.plan(9);
    var inserted = 0;
    var validityError = new Error('no geometry found');
    function validator(tempTable, fields) {
      t.ok(true, 'validator ran');
      if (fields.has('the_geom')) {
        return Promise.resolve();
      } else {
        return Promise.reject(validityError);
      }
    }
    var stream1 = intoCartodb(auth.user, auth.key, table, {
      validations: [validator]
    }, function (err) {
      t.error(err, 'no error');
      t.equals(inserted, 40);
      cartodb(table).count('num').exec(function (err, resp) {
        t.error(err);
        t.deepEquals(resp, [{count: 40}]);
        var stream2 = intoCartodb(auth.user, auth.key, table, {
          validations: [validator],
          method: 'replace'
        }, function (err) {
          t.equals(validityError, err, 'correct error');
          cartodb(cartodb.raw('information_schema.tables')).count('table_name').where('table_name', table).exec(function (err, resp) {
            t.error(err);
            t.deepEquals(resp, [{count: 1}]);
          });
        });
        var i = -1;
        while (++i < 40) {
          stream2.write({
            type: 'Feature',
            properties: {
              num: i
            },
            geometry: null
          });
        }
        stream2.end();
      });
    });
    stream1.on('inserted', function (num) {
      inserted += num;
    });
    var i = -1;
    while (++i < 40) {
      stream1.write({
        type: 'Feature',
        properties: {
          num: i
        },
        geometry: {
          type: 'Point',
          coordinates: [i, i]
        }
      });
    }
    stream1.end();
  });
  t.test('maybe delete', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(table).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('test validation cleanup', function (t) {
    t.plan(4);
    var validityError = new Error('no geometry found');
    function validator(tempTable, fields) {
      t.ok(true, 'validator ran');
      if (fields.has('the_geom')) {
        return Promise.resolve();
      } else {
        return Promise.reject(validityError);
      }
    }
    var stream1 = intoCartodb(auth.user, auth.key, table, {
      validations: [validator]
    }, function (err) {
      t.equals(validityError, err, 'correct error');
      cartodb(cartodb.raw('information_schema.tables')).count('table_name').where('table_name', table).exec(function (err, resp) {
        t.error(err);
        t.deepEquals(resp, [{count: 0}]);
      });
    });

    var i = -1;
    while (++i < 40) {
      stream1.write({
        type: 'Feature',
        properties: {
          num: i
        },
        geometry: null
      });
    }
    stream1.end();
  });
  t.test('maybe delete', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(table).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('test validation groups', function (t) {
    t.plan(4);
    function validator(tempTable, fields, db, group) {
      t.ok(true, 'validator ran');
      group.add('even');
      fields.set('num', 'sum(num) as num');
      fields.set('the_geom', 'ST_Union(the_geom) as the_geom');
      return Promise.resolve();
    }
    var stream1 = intoCartodb(auth.user, auth.key, table, {
      validations: [validator]
    }, function (err) {
      t.error(err);
      cartodb(table).select('even', 'num').exec(function (err, resp) {
        t.error(err);
        t.deepEquals(resp.sort(function (a, b) {
          if (a.num > b.num) {
            return 1;
          }
          return -1;
        }), [{even: true, num: 380}, {even: false, num: 400}]);
      });
    });

    var i = -1;
    while (++i < 40) {
      stream1.write({
        type: 'Feature',
        properties: {
          num: i,
          even: !(i % 2)
        },
        geometry: {
          type: 'Point',
          coordinates: [i, i]
        }
      });
    }
    stream1.end();
  });
  t.test('maybe delete', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(table).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('test dedupping', function (t) {
    t.plan(3);
    var stream1 = intoCartodb(auth.user, auth.key, table, function (err) {
      t.error(err);
      cartodb(table).count('*').exec(function (err, resp) {
        t.error(err);
        t.deepEquals(resp, [{count: 3}]);
      });
    });

    var i = -1;
    while (++i < 100) {
      stream1.write({
        type: 'Feature',
        properties: {
          num: i % 3
        },
        geometry: {
          type: 'Point',
          coordinates: [i % 3, i % 3]
        }
      });
    }
    stream1.end();
  });
  t.test('maybe delete with dash', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(tablewithOutDash).exec(function (err) {
      t.error(err, 'no error');
    });
  });
  t.test('create with dash', function (t) {
    var inserted = 0;
    var stream = intoCartodb(auth.user, auth.key, tablewithDash, function (err) {
      t.error(err, 'no error');
      t.equals(inserted, 160);
      cartodb(tablewithOutDash).select().where('foo_blahoela', 'foo_blahoela').where('_as', '_as').where('fooo', 'fooo').where('dash_dash', 'dash-dash').exec(function (err, resp) {
        t.error(err, 'no error');
        t.equals(resp && resp.length, 160);
        t.end();
      });
    });
    stream.on('inserted', function (num) {
      t.ok(true, 'inserted');
      inserted += num;
    });
    var i = -1;
    while (++i < 160) {
      stream.write({
        type: 'Feature',
        properties: {
          num: i,
          1: 1,
          'foo.blahœla': 'foo_blahoela',
          '<foo>as': '_as',
          '?#fooo': 'fooo',
          'dash-dash': 'dash-dash'
          },
        geometry: null
      });
    }
    stream.end();
  });
  t.test('maybe delete with dash', function (t) {
    t.plan(1);
    cartodb.schema.dropTableIfExists(tablewithOutDash).exec(function (err) {
      t.error(err, 'no error');
    });
  });
});
