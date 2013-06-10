var htmlparser = require("htmlparser2");
var dom = require("./lib/dom-level1").dom.level1.core;
// add textContent
require("./lib/dom-level3");
// add outerHTML, innerHTML
require("./lib/extras");

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

function Handler(document) {
    this.document = document;

    this._currentElement = document;
    this._insertionMode = this.INITIAL_MODE;
    this._reset = false;
}

Handler.prototype = {
    INITIAL_MODE: 1,
    BEFORE_HTML_MODE: 2,
    BEFORE_HEAD_MODE: 3,

    onopentag: function (tagName, attributes) {
        // console.log(" open", tagName);
        var el = this.document.createElement(tagName);

        for (var name in attributes) {
            if (attributes.hasOwnProperty(name)) {
                el.setAttribute(name, attributes[name]);
            }
        }

        this._currentElement.appendChild(el);
        this._currentElement = el;
    },

    onclosetag: function (tagName) {
        // console.log("close", tagName);
        this._currentElement = this._currentElement.parentNode;
        // console.log("pNode", this._currentElement.tagName);
    },

    ontext: function (text) {
        var node = this.document.createTextNode(text);
        this._currentElement.appendChild(node);
    },

    onprocessinginstruction: function (target, data) {
        var node;
        if (target.toLowerCase() === "!doctype") {
            if (this._insertionMode !== this.INITIAL_MODE) {
                this.document.raise("error", "Stray doctype", data);
                return;
            }
            if (!/!doctype html/i.test(data)) {
                this.document.raise("error", "Quirky doctype", data);
            }

            // TODO parse doctype
            node = new dom.DocumentType(this.document, "html");
            this.document.appendChild(node);

            this.document.doctype = node;

            this._insertionMode = this.BEFORE_HTML_MODE;
        } else {
            node = this.document.createProcessingInstruction(target, data);
            this._currentElement.appendChild(node);
        }
    },

    oncomment: function (data) {
        var comment = this.document.createComment(data);
        this._currentElement.appendChild(comment);
    },

    oncdatastart: function (data) {
        var cdata = this.document.createCDATASection(data);
        this._currentElement.appendChild(cdata);
    },

    onerror: function (error) {
        throw error;
    },

    onreset: function () {
        if (this._reset) {
            throw new Error("Cannot reset handler a second time");
        }
        this._reset = true;
    }
};
