/*global describe, it, expect */

var minidom = require("../minidom");

var FS = require("fs");
var PATH = require("path");

var DATA_DIR = "html5lib";
var NEW_TEST_HEADING = "data";
var HEADINGS = { line: true, data: true, error: true, document: true };

describe("html5lib", function () {

    describe("test.dat", function () {
        var tests = readDat("test.dat");
        tests.forEach(function (data) {
            // If there is a key we don't recognise (e.g. document-fragment),
            // skip the test
            if (!Object.keys(data).every(function (key) { return key in HEADINGS; })) {
                it("skipping test on line " + data.line + " because of unrecognised key");
            }

            makeIt("line " + data.line, data);
        });
    });

});

function makeIt(name, data) {
    it(name, function () {
        minidom(data.data);
    });
}

// adapted directly from html5lib-python
// https://github.com/html5lib/html5lib-python/blob/96da7f5f8ccfbdbf2fb2e92dff0c310ed7a01bea/html5lib/tests/support.py#L76
function readDat(filename) {
    var tests = [];

    var content = FS.readFileSync(PATH.join(__dirname, DATA_DIR, filename), "utf8");
    var lines = content.split("\n");

    var data = {line : 1},
        key;
    for (var i = 0, len = lines.length; i < len; i++) {
        var line = lines[i];

        var heading = isSectionHeading(line);
        if (heading) {
            if (data.data && heading === NEW_TEST_HEADING) {
                // Don't need to remove trailing newline because .split()
                // does not keep the separator in the string
                tests.push(data);
                data = {line: i + 1};
            }
            key = heading;
            data[key] = "";
        } else if (key) {
            data[key] += line;
        }
    }

    if (data.data) {
        tests.push(data);
    }

    return tests;
}

function isSectionHeading(line) {
    if (line.charAt(0) === "#") {
        return line.substring(1);
    } else {
        return false;
    }
}
