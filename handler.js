var dom = require("./lib/dom-level1").dom.level1.core;

module.exports = Handler;
function Handler(document) {
    this.document = document;

    this._currentElement = document;
    this._insertionMode = INITIAL_MODE;
    this._reset = false;
}

Handler.prototype = {
    onerror: function (error) {
        throw error;
    },

    onreset: function () {
        if (this._reset) {
            throw new Error("Cannot reset handler a second time");
        }
        this._reset = true;
    },

    else: function (fnName, args) {
        var elseFn;
        if ((elseFn = this._insertionMode.else)) {
            elseFn.call(this, fnName, args);
        } else {
            throw new Error("Missing else function. Called from " + fnName);
        }
    }
};

// Double dispatch for the handler functions so that we can swap out the mode
// as needed
[
    "onopentag", "onclosetag",
    "ontext", "onprocessinginstruction",
    "oncomment", "oncdatastart"
].forEach(function (fnName) {
    Handler.prototype[fnName] = function () {
        console.log(this._insertionMode.name, fnName, arguments);
        var modeFn, elseFn;
        if ((modeFn = this._insertionMode[fnName])) {
            modeFn.apply(this, arguments);
        } else if ((elseFn = this._insertionMode.else)) {
            elseFn.call(this, fnName, arguments);
        } else {
            DEFAULT[fnName].apply(this, arguments);
        }
    };
});

var DEFAULT = {
    onprocessinginstruction: function (target, data) {
        if (target.toLowerCase() === "!doctype") {
            this.document.raise("error", "Stray doctype", data);
            // ignore token
        } else {
            // FIXME Probably an error?
            var node = this.document.createProcessingInstruction(target, data);
            this._currentElement.appendChild(node);
        }
    },

    ontext: function (text) {
        var node = this.document.createTextNode(text);
        this._currentElement.appendChild(node);
    },

    oncomment: function (data) {
        var comment = this.document.createComment(data);
        this._currentElement.appendChild(comment);
    },

    onopentag: function (tagName, attributes) {
        var el = this.document.createElement(tagName);

        if (attributes) {
            for (var name in attributes) {
                if (attributes.hasOwnProperty(name)) {
                    el.setAttribute(name, attributes[name]);
                }
            }
        }

        this._currentElement.appendChild(el);
        this._currentElement = el;
    }
};

// 12.2.5.4.1 The "initial" insertion mode
var INITIAL_MODE = {
    name: "INITIAL_MODE",

    ontext: function (text) {
        // only ignore whitespace text
        if (text.trim() !== text) {
            this.else("ontext", [text]);
        }
    },

    oncomment: DEFAULT.oncomment,

    onprocessinginstruction: function (target, data) {
        var node;
        if (target.toLowerCase() === "!doctype") {
            if (!/!doctype html/i.test(data)) {
                this.document.raise("error", "Quirky doctype", data);
            }

            // TODO parse doctype
            node = new dom.DocumentType(this.document, "html");
            this.document.appendChild(node);

            this.document.doctype = node;

            this._insertionMode = this.BEFORE_HTML_MODE;
        } else {
            this.else("onprocessinginstruction", [target, data]);
        }
    },

    else: function (fnName, args) {
        this.document.raise("error", "Unexpected content seen without seeing a doctype first. Expected <!DOCTYPE html>");

        this._insertionMode = BEFORE_HTML_MODE;
        this[fnName].apply(this, args);
    }
};

// 12.2.5.4.2 The "before html" insertion mode
var BEFORE_HTML_MODE = {
    name: "BEFORE_HTML_MODE",

    onprocessinginstruction: DEFAULT.onprocessinginstruction,
    oncomment: DEFAULT.oncomment,

    ontext: INITIAL_MODE.ontext,

    onopentag: function (tagName, attributes) {
        // TODO toLowerCase?
        if (tagName === "html") {
            DEFAULT.onopentag.call(this, tagName, attributes);
            this._insertionMode = BEFORE_HEAD_MODE;
        } else {
            this.else("onopentag", arguments);
        }
    },

    else: function (fnName, args) {
        DEFAULT.onopentag.call(this, "html");

        this._insertionMode = BEFORE_HEAD_MODE;
        this[fnName].apply(this, args);
    }
};

// 12.2.5.4.3 The "before head" insertion mode
var BEFORE_HEAD_MODE = {
    name: "BEFORE_HEAD_MODE",

    ontext: INITIAL_MODE.ontext,

    oncomment: DEFAULT.oncomment,
    onprocessinginstruction: DEFAULT.onprocessinginstruction,

    onopentag: function (tagName, attributes) {
        if (tagName === "html") {
            return IN_BODY_MODE.onopentag.call(this, tagName, attributes);
        } else if (tagName === "head") {
            DEFAULT.onopentag.call(this, tagName, attributes);
            this.document.head = this._currentElement;
            this._insertionMode = IN_HEAD_MODE;
        }
    },

    else: function (fnName, args) {
        this.onopentag("head");
        this[fnName].apply(this, args);
    }
};

// 12.2.5.4.4 The "in head" insertion mode
var IN_HEAD_MODE = {
    name: "IN_HEAD_MODE",

    ontext: function (text) {
        if (text.trim() === text) {
            DEFAULT.ontext.call(this, text);
        } // TODO else
    },

    onprocessinginstruction: DEFAULT.onprocessinginstruction,
    onopentag: function(tagName, attributes) {
        if (tagName === "html") {
            return IN_BODY_MODE.onopentag.call(this, tagName, attributes);
        // TODO "A start tag whose tag name is one of: "base", "basefont", "bgsound", "link""
        } else if (tagName === "meta") {
            DEFAULT.onopentag.call(this, tagName, attributes);
            // "Immediately pop the current node off the stack of open elements."
            this._currentElement = this._currentElement.parentNode;
            // TODO character encoding
        } else if (tagName === "title") {
            DEFAULT.onopentag.call(this, tagName, attributes);
            this._insertionMode = NON_SPEC_TITLE_MODE;
        }
    },

    onclosetag: function (tagName) {
        if (tagName !== "meta") {
            this.else("onclosetag", tagName);
        }
    }

};


// Because we don't implement the tokenizer ourselves we can't follow the
// "generic RCDATA element parsing algorithm" which requires switching the
// tokenizer to "RCDATA state".
//
// For the moment this ignores anything that isn't text.
// TODO 1a: Stringify anything that isn't text, like tags, comments, etc.
// TODO 1b: Capture the start position of the tokenizer when entering this
// mode, then capture the position at the close title tag, grab the contents
// of the input string between these two locations and insert directly.
// TODO 2: Implement our own tokenizer so that we can follow the spec
// accurately.
var NON_SPEC_TITLE_MODE = {
    name: "NON_SPEC_TITLE_MODE",

    onclosetag: function (tagName) {
        if (tagName === "title") {
            DEFAULT.ontext.call(this, this._titleTextBuffer);
            delete this._titleTextBuffer;
            this._insertionMode = IN_HEAD_MODE;
        }
    },

    ontext: function (text) {
        if (!this._titleTextBuffer) {
            this._titleTextBuffer = "";
        }
        this._titleTextBuffer += text;
    },

    else: function () {
        // ignore
    }

};


// Handler.prototype = {
//     INITIAL_MODE: 1,
//     BEFORE_HTML_MODE: 2,
//     BEFORE_HEAD_MODE: 3,

//     onopentag: function (tagName, attributes) {
//         var el = this.document.createElement(tagName);

//         for (var name in attributes) {
//             if (attributes.hasOwnProperty(name)) {
//                 el.setAttribute(name, attributes[name]);
//             }
//         }

//         this._currentElement.appendChild(el);
//         this._currentElement = el;
//     },

//     onclosetag: function (tagName) {
//         this._currentElement = this._currentElement.parentNode;
//     },

//     ontext: function (text) {
//         var node = this.document.createTextNode(text);
//         this._currentElement.appendChild(node);
//     },

//     onprocessinginstruction: function (target, data) {
//         var node;
//         if (target.toLowerCase() === "!doctype") {
//             if (this._insertionMode !== this.INITIAL_MODE) {
//                 this.document.raise("error", "Stray doctype", data);
//                 return;
//             }
//             if (!/!doctype html/i.test(data)) {
//                 this.document.raise("error", "Quirky doctype", data);
//             }

//             // TODO parse doctype
//             node = new dom.DocumentType(this.document, "html");
//             this.document.appendChild(node);

//             this.document.doctype = node;

//             this._insertionMode = this.BEFORE_HTML_MODE;
//         } else {
//             node = this.document.createProcessingInstruction(target, data);
//             this._currentElement.appendChild(node);
//         }
//     },

//     oncomment: function (data) {
//         var comment = this.document.createComment(data);
//         this._currentElement.appendChild(comment);
//     },

//     oncdatastart: function (data) {
//         var cdata = this.document.createCDATASection(data);
//         this._currentElement.appendChild(cdata);
//     },

//     onerror: function (error) {
//         throw error;
//     },

//     onreset: function () {
//         if (this._reset) {
//             throw new Error("Cannot reset handler a second time");
//         }
//         this._reset = true;
//     }
// };
