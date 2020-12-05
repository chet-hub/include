class Tag {

    constructor(tagContent) {
        //console.assert(typeof (tagContent) === 'string' && (tagContent.trim().length > 0), `"tag should be root required"`)
        this.tagContent = tagContent || "";
        this.attribute = {};
        this.content = null;
    }

    config(requestFunction,parseTagFunction,parseContentFunction) {
        if (requestFunction instanceof Function) {
            this.requestFunction = requestFunction;
        }
        if (parseTagFunction instanceof Function) {
            this.parseTagFunction = parseTagFunction;
        }
        if (parseContentFunction instanceof Function) {
            this.parseContentFunction = parseContentFunction;
        }
    }

    requestContent(callback) {
        this.attribute = this.parseTagFunction(this.tagContent);
        const that = this;
        this.requestFunction(this.attribute, function (content) {
            that.content = content;
            callback(content)
        })
    }

    parseContent() {
        return this.parseContentFunction(this.content)
    }
}

Tag.prototype.requestFunction = function (attribute, fn) {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
            if (fn instanceof Function)
                fn(this.responseText);
        }
    };
    xhttp.open("GET", attribute.src + "?time=" + new Date().getTime(), true);
    xhttp.send();
}

Tag.prototype.parseTagFunction = function (tagString) {
    const reg = /(\S+)\s*=\s*([']|[\"])([\W\w]*?)\2/g
    return Array.from(tagString.matchAll(reg)).reduce(function (context, value) {
        context[value[1]] = value[3]
        return context;
    }, {})
}

/**
 * [String,Tag,String,Tag,String]
 */
Tag.prototype.parseContentFunction = function (source) {
    const tagName = "include";
    //const reg = /(<include[^>]*>(.*?)<\s*\/\s*include>|<\s*include[^>]*\/\s*>)/g
    const reg = new RegExp('(<' + tagName + '[^>]*>(.*?)<\s*\/\s*' + tagName + '>|<\s*' + tagName + '[^>]*\/\s*>)', 'g')
    const result = Array.from(source.matchAll(reg)).reduce(function (context, value) {
        const matchText = value[0];
        const index = value.index;
        let lastIndex = context['LastIndex'];
        if (lastIndex === undefined) {
            lastIndex = 0;
        }
        context.push(new String(source.substring(lastIndex, index)))
        context['LastIndex'] = index + matchText.length
        context.push(new Tag(matchText));
        return context;
    }, [])
    result.push(new String(source.substring(result['LastIndex'])))
    return result;
};


Tag.config = function (requestFunction, parseTagFunction, parseContentFunction) {
    if (requestFunction instanceof Function) {
        Tag.prototype.requestFunction = requestFunction;
    }
    if (parseTagFunction instanceof Function) {
        Tag.prototype.parseTagFunction = parseTagFunction;
    }
    if (parseContentFunction instanceof Function) {
        Tag.prototype.parseContentFunction = parseContentFunction;
    }
}


class Node {
    constructor(tag, parent) {
        if (!(tag instanceof Object)) {
            console.assert(false, "tag should be not empty")
        }
        //require value
        this.tag = tag;
        //content
        this.contentArray = []; //[string,tag,string,tag,string,tag]
        //inherit
        this.parent = parent;
        this.children = [];  // [node, node, node...]
        //status of the node
        this.isValid = true;
        this.isLoad = false;
        this.isCompletelyLoad = false;
    }

    include() {
        const doInclude = function (node) {
            node.onBeforeRequest(node.tag)
            node.tag.requestContent(function (content) {
                node.onAfterRequest(node)
                if (node.isCircularReference(content)) {
                    node.contentArray = [];
                    node.isValid = false;
                } else {
                    node.contentArray = node.tag.parseContent(content)
                }
                node.onAfterLoaded(node.tag, node.contentArray);
                node.contentArray.filter(function (v) {
                    return v instanceof Tag
                }).forEach(function (tag) {
                    const child = node.addChild(tag)
                    doInclude(child)
                })
            })
        }
        doInclude(this);
    }

    addChild(tag) {
        const childNode = new Node(tag, this);
        childNode.parent = this;
        const length = this.children.push(childNode);
        this.onAfterChildAdded(childNode, length - 1)
        return childNode;
    }

    isCircularReference(content) {
        const tags = [];
        const getParent = function (node) {
            if (node.parent) {
                tags.push(node.parent.tag)
                getParent(node.parent)
            }
        }
        getParent(this)
        return tags.some(function (tag) {
            return tag.content === content
        })
    }

    printTree() {
        const printNode = function (i, n) {
            const tabs = "\t".repeat(i++)
            console.log(tabs + n.tag.content)
            n.children.forEach(function (child) {
                printNode(i, child)
            })
        }
        printNode(0, this);
    }

    toString() {
        const treeToString = function (node) {
            if (!(node instanceof Node) || !node.isLoad || node.isValid === false) return ""
            let i = 0;
            node.onToString(node.tag)
            const result =  node.contentArray.reduce(function (context, value) {
                if (value instanceof String) {
                    context.push(value)
                } else if (value instanceof Tag) {
                    const child = node.children[i++];
                    context.push(treeToString(child))
                } else {
                    console.assert(false, "unsupported type")
                }
                return context;
            }, []).join("");
            return result;
        }
        return treeToString(this);
    }
    onAfterRequest(node){
        this.onAfterRequestListeners.forEach(function (listener) {
            listener(node)
        })
    }

    onAfterChildAdded(child, index) {
        // console.log(`onAfterChildLoaded: ${child} -> [${index}]`);
        this.onAfterChildAddedListeners.forEach(function (listener) {
            listener(child, index)
        })
    }

    onAfterLoaded(tag, contentArray) {
        //add content to the node and parse the content
        this.isLoad = true;
        //fire listener
        if (this.isValid) {
            this.onAfterLoadedListeners.forEach(function (listener) {
                listener(tag, contentArray)
            })
        }
        if (!this.isValid) {
            this.isCompletelyLoad = true;
        }
        // contentArray:
        // []                       invalid node
        // [string]                 leaf Node
        // [string tag string tag]  not Leaf node
        const isLeafNode = (contentArray.length === 1)
        if (isLeafNode || !this.isValid) {//leaf Node
            const fireCompletelyLoad = function (node) {
                node.onAfterCompletelyLoaded(node);
                if (node.parent) {
                    const allLoad = node.parent.children.every(function (v) {
                        return v.isCompletelyLoad === true;
                    })
                    if (allLoad) {
                        fireCompletelyLoad(node.parent)
                    }
                }
            }
            fireCompletelyLoad(this);
        }
    }

    tagConfig(tag) {
        if (this.onSetRequestFunction instanceof Function) {
            const fn = this.onSetRequestFunction(tag)
            if (fn instanceof Function) {
                this.tag.config(fn, null, null)
            }
        }
        if (this.onSetParseTagFunction instanceof Function) {
            const fn = this.onSetParseTagFunction(tag)
            if (fn instanceof Function) {
                this.tag.config(null, fn, null)
            }
        }
        if (this.onSetParseContentFunction instanceof Function) {
            const fn = this.onSetParseContentFunction(tag)
            if (fn instanceof Function) {
                this.tag.config(null,null, fn)
            }
        }
    }

    onBeforeRequest(tag) {
        this.tagConfig(tag);
        // console.log("onBeforeRequest:" + tag);
        this.onBeforeRequestListeners.forEach(function (listener) {
            listener(tag)
        })
    }

    onAfterCompletelyLoaded(node) { //load its content and its children's content
        // console.log("onAfterCompletelyLoaded:" + this);
        if (!this.isCompletelyLoad) {
            this.isCompletelyLoad = true;
            this.onAfterCompletelyLoadedListeners.forEach(function (listener) {
                listener(node)
            })
        }
    }

    onToString(tag) {
        // console.log("onBeforeInsertToParentContent:" + tag)
        this.onToStringListeners.forEach(function (listener) {
            listener(tag)
        })
    }
}

Node.event = {
    //Node events
    BeforeRequest: "BeforeRequest",
    AfterRequest: "AfterRequest",
    AfterLoaded: "AfterLoaded",
    AfterChildAdded: "AfterChildAdded",
    AfterCompletelyLoaded: "AfterCompletelyLoaded",
    ToString: "ToString",
    //Tag events
    SetRequestFunction: "SetRequestFunction",
    SetParseTagFunction: "SetParseTagFunction",
    SetParseContentFunction: "SetParseContentFunction"
}

Node.prototype.onBeforeRequestListeners = []
Node.prototype.onAfterRequestListeners = []
Node.prototype.onAfterLoadedListeners = []
Node.prototype.onAfterChildAddedListeners = []
Node.prototype.onAfterCompletelyLoadedListeners = []
Node.prototype.onToStringListeners = []
Node.prototype.onSetRequestFunction = null
Node.prototype.onSetParseTagFunction = null
Node.prototype.onSetParseContentFunction = null

Node.addListener = function (event, fn) {
    if (event === Node.event.SetRequestFunction) {
        Node.prototype.onSetRequestFunction = fn
    } else if (event === Node.event.SetParseTagFunction) {
        Node.prototype.onSetParseTagFunction = fn
    } else if (event === Node.event.SetParseContentFunction) {
        Node.prototype.onSetParseContentFunction = fn
    } else {
        Node.prototype["on" + event + "Listeners"].push(fn)
    }
}


const include = {
    event:Node.event,
    addListener:function (event,fn){
        Node.addListener(event,fn)
        return this;
    },
    done:function(cb){
        const tag = new Tag();
        const root = new Node(tag);
        root.include();
        //root.printTree();
        include.addListener(include.event.AfterCompletelyLoaded, function (n) {
            if(n === root){
                cb(root.toString())
            }
        })
    }
}


/////////////////test////////////////////////////
//
// const data = {
//     root: `root[<include src="node1" id="1" />,<include src="node4" id="2"/>]`,
//     node1: `node1[<include src="node2" id="3"/>,<include src="node3" id="4"/>]`,
//     node2: `node2[<include src="node3" id="5"/>]`,
//     node3: `node3[<include src="node1" id="6"/>]`,
//     node4: `node4`,
// }
//
// const data = {
//     root: `root[<include src="node1" id="1" />]`,
//     node1: `node1[<include src="node2" id="2"/>`,
//     node2: `node2[<include src="node3" id="3"/>]`,
//     node3: `node3[<include src="node2" id="4"/>]`
// }
//
//
// const requestFunction = function (attribute, callback) {
//     let content;
//     if (attribute.src) {
//         content = data[attribute.src]
//     } else {
//         content = data.root
//     }
//     //setTimeout(callback,2000,content)
//     callback(content)
// }
//
// include.addListener(include.event.SetRequestFunction, function (tag){
//     return requestFunction
// })
//
// include.addListener(include.event.BeforeRequest, function (tag) {
//     console.log("BeforeRequest:\t\t" + JSON.stringify(tag));
// })
//
// include.addListener(include.event.AfterRequest, function (node) {
//     console.log("AfterRequest:\t\t" + JSON.stringify(node.tag));
// })
//
// include.addListener(include.event.AfterLoaded, function (tag, contentArray) {
//     console.log("AfterLoaded:\t\t" + JSON.stringify(contentArray));
// })
//
// include.addListener(include.event.AfterChildAdded, function (child, index) {
//     console.log("AfterChildAdded:\t[" + index + "]" + JSON.stringify(child.tag));
// })
//
// include.addListener(include.event.AfterCompletelyLoaded, function (node) {
//     console.log("AfterCompletelyLoaded:\t" + JSON.stringify(node.tag));
// })
//
// include.addListener(Node.event.ToString, function (tag) {
//     console.log("ToString:\t\t" + JSON.stringify(tag));
// })
//
// include.done();
/////////////////test////////////////////////////

window.addEventListener('DOMContentLoaded', (event) => {
    include.addListener(include.event.SetRequestFunction, function (tag){
        if(tag.tagContent === ''){
            return function (attribute, callback) {
                //setTimeout(callback,1000,document.documentElement.innerHTML)
                callback(document.documentElement.innerHTML)
            }
        }
    }).done(function (result){
        console.log(result)
        document.documentElement.innerHTML = result;
    })
})

