var htmlparser = require("htmlparser2");
var dom = require("./lib/dom-level1").dom.level1.core;
// add textContent
require("./lib/dom-level3");
// add outerHTML, innerHTML
require("./lib/extras");

var Handler = require("./handler");

var DOCUMENT_OPTIONS = {
    contentType: "text/html"
};

var exports = module.exports = function minidom(html) {
    if (!html) {
        html = "<html><head></head><body></body></html>";
    }

    var document = new dom.Document(DOCUMENT_OPTIONS);
    // We only work with the HTML doctype
    document.doctype = new dom.DocumentType(document, "html");

    var handler = new Handler(document);
    var parser = new htmlparser.Parser(handler);

    parser.parseComplete(html);

    return document;
};

exports.dom = dom;

