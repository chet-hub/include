(function (exports) {

    class Listeners {
        constructor() {
            this.onBeforeRequestListeners = []
            this.onAfterRequestListeners = []
            this.onAfterLoadedListeners = []
            this.onAfterChildAddedListeners = []
            this.onAfterCompletelyLoadedListeners = []
            this.onToStringListeners = []
            this.onSetRequestFunction = null
            this.onSetParseTagFunction = null
            this.onSetParseContentFunction = null
        }

        addListener = function (event, fn) {
            if (event === Listeners.event.SetRequestFunction) {
                this.onSetRequestFunction = fn
            } else if (event === Listeners.event.SetParseTagFunction) {
                this.onSetParseTagFunction = fn
            } else if (event === Listeners.event.SetParseContentFunction) {
                this.onSetParseContentFunction = fn
            } else {
                this["on" + event + "Listeners"].push(fn)
            }
        }
    }

    class Tag {

        constructor(tagContent) {
            //console.assert(typeof (tagContent) === 'string' && (tagContent.trim().length > 0), `"tag should be root required"`)
            this.tagContent = tagContent || "";
            this.attribute = {};
            this.content = null;
        }

        config(requestFunction, parseTagFunction, parseContentFunction) {
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
        let xhttp;
        if (window.XMLHttpRequest) {
            // code for modern browsers
            xhttp = new XMLHttpRequest();
        } else {
            // code for old IE browsers
            xhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
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
            if (context['LastIndex'] === undefined) {
                context['LastIndex'] = 0;
            }
            context.push(new String(source.substring(context['LastIndex'], index)))
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
            this.isRoot = false;
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
                        node.contentArray = node.tag.parseContent()
                    }
                    node.onAfterLoaded(node);
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
                console.log(tabs + n.tag.tagContent)
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

                const result = node.contentArray.reduce(function (context, value) {
                    if (value instanceof String) {
                        if (node.contentArray.every((v) => {
                            return v instanceof String
                        })) {
                            const data = {node: node, doc: node.contentArray.join("")}
                            node.onToString(data)
                            context.push(data.doc)
                        } else {
                            context.push(value)
                        }
                    } else if (value instanceof Tag) {
                        const child = node.children[i++];
                        const doc = treeToString(child);
                        const data = {node: child, doc: doc}
                        child.onToString(data)
                        context.push(data.doc)
                    } else {
                        console.assert(false, "unsupported type")
                    }
                    return context;
                }, []).join("");
                return result;
            }
            const doc = treeToString(this);
            const data = {node: this, doc: doc}
            this.onToString(data)
            return data.doc;
        }

        onAfterRequest(node) {
            this.getRootNode().listeners.onAfterRequestListeners.forEach(function (listener) {
                listener(node)
            })
        }

        onAfterChildAdded(child, index) {
            // console.log(`onAfterChildLoaded: ${child} -> [${index}]`);
            this.getRootNode().listeners.onAfterChildAddedListeners.forEach(function (listener) {
                listener(child, index)
            })
        }

        onAfterLoaded(node) {
            //add content to the node and parse the content
            this.isLoad = true;
            //fire listener
            if (this.isValid) {
                this.getRootNode().listeners.onAfterLoadedListeners.forEach(function (listener) {
                    listener(node)
                })
            }
            if (!this.isValid) {
                this.isCompletelyLoad = true;
            }
            // contentArray:
            // []                       invalid node
            // [string]                 leaf Node
            // [string tag string tag]  not Leaf node
            const isLeafNode = (node.contentArray.length === 1)
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
            if (this.getRootNode().listeners.onSetRequestFunction instanceof Function) {
                const fn = this.getRootNode().listeners.onSetRequestFunction(tag)
                if (fn instanceof Function) {
                    this.tag.config(fn, null, null)
                }
            }
            if (this.getRootNode().listeners.onSetParseTagFunction instanceof Function) {
                const fn = this.getRootNode().listeners.onSetParseTagFunction(tag)
                if (fn instanceof Function) {
                    this.tag.config(null, fn, null)
                }
            }
            if (this.getRootNode().listeners.onSetParseContentFunction instanceof Function) {
                const fn = this.getRootNode().listeners.onSetParseContentFunction(tag)
                if (fn instanceof Function) {
                    this.tag.config(null, null, fn)
                }
            }
        }

        onBeforeRequest(tag) {
            this.tagConfig(tag);
            // console.log("onBeforeRequest:" + tag);
            this.getRootNode().listeners.onBeforeRequestListeners.forEach(function (listener) {
                listener(tag)
            })
        }

        onAfterCompletelyLoaded(node) { //load its content and its children's content
            // console.log("onAfterCompletelyLoaded:" + this);
            if (!this.isCompletelyLoad) {
                this.isCompletelyLoad = true;
                this.toString();
                this.getRootNode().listeners.onAfterCompletelyLoadedListeners.forEach(function (listener) {
                    listener(node)
                })
            }
        }

        onToString(data) {
            this.getRootNode().listeners.onToStringListeners.forEach(function (listener) {
                listener(data)
            })
        }

        getRootNode() {
            const doGetRootNode = function (node) {
                if (!node.parent) {
                    return node;
                } else {
                    return doGetRootNode(node.parent);
                }
            }
            return doGetRootNode(this);
        }

        setListeners(listeners) {
            this['listeners'] = listeners;
        }
    }

    Listeners.event = {
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


    const include = {
        event: Listeners.event,
        load: function (src) {

            //init classes;
            const tag = new Tag();
            const root = new Node(tag);
            root.isRoot = true;
            const listeners = new Listeners();
            root.setListeners(listeners)

            //init Listeners in node and browser
            if (exports.isBrowser) {//default
                window.addEventListener('DOMContentLoaded', (event) => {
                    listeners.addListener(include.event.SetRequestFunction, function (tag) {
                        if (tag.tagContent === '') {
                            if (src) {//use default requestFunction
                                return null
                            } else {
                                return function (attribute, callback) {
                                    callback(document.documentElement.innerHTML)
                                }
                            }
                        }
                    }).done(function (result) {// there will be a problem if include js code
                        //todo
                        document.documentElement.innerHTML = result
                        Array.from(document.querySelectorAll("script")).forEach(function (code) {
                            eval(code.text);
                        })
                    })
                })
                delete exports.isBrowser;
            } else {
                Tag.prototype.requestFunction = function (attribute, fn) {
                    require("fs").readFile(attribute.src, function (err, data) {
                        if (err) {
                            return console.error(err);
                        }
                        fn(data.toString())
                    });
                }
                listeners.addListener(include.event.SetRequestFunction, function (tag) {
                    if (tag.tagContent === '') {
                        tag.attribute['src'] = src;
                        return function (attribute, fn) {
                            require("fs").readFile(src, function (err, data) {
                                if (err) {
                                    return console.error(err);
                                }
                                fn(data.toString())
                            });
                        }
                    }
                })
            }
            //return the interface
            return {
                addListener: function (event, fn) {
                    listeners.addListener(event, fn)
                    return this;
                },
                done: function (cb) {
                    root.include();
                    cb(root);
                }
            }
        }
    }

    exports.event = include.event;
    exports.load = include.load;

})(typeof exports === 'undefined' ? this['include'] = {isBrowser: true} : exports);






