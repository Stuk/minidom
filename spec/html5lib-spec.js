/*global describe, it, expect */

var minidom = require("../minidom");

var FS = require("fs");
var PATH = require("path");

var DATA_DIR = "html5lib";
var NEW_TEST_HEADING = "data";
var HEADINGS = { line: true, data: true, errors: true, document: true };

describe("html5lib", function () {

    describe("test.dat", function () {
        var tests = readDat("test.dat");
        tests.forEach(function (data) {
            // If there is a key we don't recognise (e.g. document-fragment),
            // skip the test
            if (!Object.keys(data).every(function (key) { return key in HEADINGS; })) {
                it("skipping test on line " + data.line + " because of unrecognised key ");
                return;
            }

            makeIt("line " + data.line, data);
        });
    });

});

function makeIt(name, data) {
    it(name, function () {
        var doc = minidom(data.data);
        expect(nodeToTestOutput(doc)).toEqual(data.document);
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
            data[key] += line + "\n";
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

function _(amount) {
    return new Array(amount + 1).join("  ");
}
function nodeToTestOutput(node, indent, output) {
    output = output || [],
    indent = indent || 0;

    var i, len, kids;

    if (node) {
        switch (node.nodeType) {
            case node.ELEMENT_NODE:
                output.push(_(indent) + "<" + node.tagName.toLowerCase() + ">");

                var attrs = node.attributes;
                // use temporary array because the attributes need to be sorted
                var tmp = [];
                for (i = 0, len = attrs.length; i < len; i++) {
                    tmp.push(_(indent + 1) + name + '="' + attrs[name] + '"');
                }
                output.push.apply(output, tmp.sort());

                kids = node.childNodes;
                for (i = 0, len = kids.length; i < len; i++) {
                    nodeToTestOutput(kids[i], indent + 1, output);
                }
                break;
            case node.TEXT_NODE:
                output.push(_(indent) + '"' + node.nodeValue + '"');
                break;
            case node.COMMENT_NODE:
                output.push(_(indent) + '<!--' + node.nodeValue + '-->');
                break;
            case node.DOCUMENT_NODE:
                kids = node.childNodes;
                for (i = 0, len = kids.length; i < len; i++) {
                    nodeToTestOutput(kids[i], indent, output);
                }
                break;
            case node.DOCUMENT_TYPE_NODE:
                output.push(stringifyDoctype(node));
                break;
        }
    }
    return "| " + output.join("\n| ");
}

// from dometohtml.js
function stringifyDoctype (doctype) {
  if (doctype.ownerDocument && doctype.ownerDocument._fullDT) {
    return doctype.ownerDocument._fullDT;
  }

  var dt = '<!DOCTYPE ' + doctype.name;
  if (doctype.publicId) {
    // Public ID may never contain double quotes, so this is always safe.
    dt += ' PUBLIC "' + doctype.publicId + '" ';
  }
  if (!doctype.publicId && doctype.systemId) {
    dt += ' SYSTEM ';
  }
  if (doctype.systemId) {
    // System ID may contain double quotes OR single quotes, not never both.
    if (doctype.systemId.indexOf('"') > -1) {
      dt += "'" + doctype.systemId + "'";
    } else {
      dt += '"' + doctype.systemId + '"';
    }
  }
  dt += '>';
  return dt;
}
