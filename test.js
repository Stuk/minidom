var minidom = require("./minidom");

var doc = minidom("<html><head><title><b>asd</b></title></head><body>hi</body></html>");
console.log(doc.innerHTML);
