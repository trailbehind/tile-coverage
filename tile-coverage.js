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

var processDirectory = function(directoryPath, callback) {
    var features = [];
    var dirInfo = path.parse(directoryPath);
    var zoom = parseInt(dirInfo.name);
    var walker = walk.walk(directoryPath, { followLinks: false });
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
            path: directoryPath
        };
        var simplified = turf.simplify(merged, 0.00001, false);
        callback(simplified);
    });
};

var produceOutput = function(features) {
    var dirFeatureCollection = turf.featurecollection(features);
    console.log(JSON.stringify(dirFeatureCollection));
};

var processDirectories = function(directories) {
    var dirFeatures = [];
    for(var i = 0; i < directories.length; i++) {
        processDirectory(directories[i], function(feature){
            dirFeatures.push(feature);
            if(dirFeatures.length == argv._.length) {
                produceOutput(dirFeatures);
            }
        });
    }
};

processDirectories(argv._);

