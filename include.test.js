
const include = require("./include.js");

// const data = {
//     root: `root[<include src="node1" id="1" />,<include src="node4" id="2"/>]`,
//     node1: `node1[<include src="node2" id="3"/>,<include src="node3" id="4"/>]`,
//     node2: `node2[<include src="node3" id="5"/>]`,
//     node3: `node3[<include src="node1" id="6"/>]`,
//     node4: `node4`,
// }

const data = {
    root: `root[<include src="node1" id="1" />]`,
    node1: `node1[<include src="node2" id="2"/>`,
    node2: `node2[<include src="node3" id="3"/>]`,
    node3: `node3[<include src="node2" id="4"/>]`
}


const requestFunction = function (attribute, callback) {
    let content;
    if (attribute.src) {
        content = data[attribute.src]
    } else {
        content = data.root
    }
    //setTimeout(callback,2000,content)
    callback(content)
}

const loaded = include.load();

loaded.addListener(include.event.SetRequestFunction, function (tag){
    return requestFunction
}).addListener(include.event.BeforeRequest, function (tag) {
    console.log("BeforeRequest:\t\t" + JSON.stringify(tag));
}).addListener(include.event.AfterRequest, function (node) {
    console.log("AfterRequest:\t\t" + JSON.stringify(node.tag));
}).addListener(include.event.AfterLoaded, function (tag, contentArray) {
    console.log("AfterLoaded:\t\t" + JSON.stringify(contentArray));
}).addListener(include.event.AfterChildAdded, function (child, index) {
    console.log("AfterChildAdded:\t[" + index + "]" + JSON.stringify(child.tag));
}).addListener(include.event.AfterCompletelyLoaded, function (node) {
    console.log("AfterCompletelyLoaded:\t" + JSON.stringify(node.tag));
}).addListener(include.event.ToString, function (data) {
    console.log("ToString:\t\t" + JSON.stringify(data.doc));
}).done(function(node){
    console.log("Done")
});





