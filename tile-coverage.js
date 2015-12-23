#!/usr/bin/env node

var turf = require('turf'),
    argv = require('yargs')
        .boolean(['tms', 'yx'])
        .argv,
    fs = require('fs'),
    walk = require('walk'),
    path = require('path'),
    SphericalMercator = require('sphericalmercator'),
    merc = new SphericalMercator({
        size: 256
    });

var yx = argv.yx;
var tms = argv.tms;
var dirFeatures = [];

for(var i = 0; i < argv._.length; i++) {
    var features = [];
    var dir = argv._[i];
    var dirInfo = path.parse(dir);
    var zoom = parseInt(dirInfo.name);
    var walker = walk.walk(dir, { followLinks: false })
    walker.on("file", function (root, fileStats, next) {
        var tilePath = path.join(root, fileStats.name);
        var tilePathInfo = path.parse(tilePath);
        var y = parseInt(tilePathInfo.name);
        var parentPathInfo = path.parse(tilePathInfo.dir);
        var x = parseInt(parentPathInfo.name)
        if(yx) {
            var tmp = x;
            x = y;
            y = tmp;
        }
        var tileBbox = merc.bbox(x, y, zoom, tms);
        //console.log(tilePath + " " + zoom + "/" + x + "/" + y + " bbox: " + tileBbox);
        features.push(turf.bboxPolygon(tileBbox));
        next();
    });

    walker.on("end", function () {
        var featureCollection = turf.featurecollection(features);
        var merged = turf.merge(featureCollection);
        merged.properties = {
            path: dir
        };
        var simplified = turf.simplify(merged, 0.00001, false);
        dirFeatures.push(simplified);
        produceOutput();
    });
}

var produceOutput = function() {
    var dirFeatureCollection = turf.featurecollection(dirFeatures);
    console.log(JSON.stringify(dirFeatureCollection));
}
