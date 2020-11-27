(function () {
  if (window['include'] === undefined) {
    /////////////////////////////////////////////
    function log(){
      //cosnole.log(arguments)
    }

    class Tag {
      constructor(tagName, source) {
        console.assert(tagName)
        console.assert(source)
        this.source = source
        //https://regex101.com/r/aVz4uG/13
        this.reg = /(\S+)\s*=\s*([']|[\"])([\W\w]*?)\2/g
        this.tagName = tagName
        this.attribute = Array.from(source.matchAll(this.reg)).reduce(function (context, value) {
          context[value[1]] = value[3]
          return context;
        }, {})
      }
    };

    class Node {
      constructor(path) {
        if (!path || (path && path.trim().length == 0)) {
          console.assert(false, "Node src is empty")
        }
        //status of the node
        this.isValide = true;
        this.isLoad = false;
        this.isCompletelyLoad = false;
        //value of the content
        this.path = path
        this.parent;
        this.text;
        //children 
        this.children = [];  // [node, node, node...]
        this.contentArray = []; //[string,tag,string,tag,string,tag]
        //listeners
        this.onLoadListeners = []
        this.onCompletelyLoadListeners = []
        this.onChildLoadListeners = []
      }
      addLoadListeners(fn) {
        this.onLoadListeners.push(fn)
      }
      addCompletelyLoadListeners(fn) {
        this.onCompletelyLoadListeners.push(fn)
      }
      addChildLoadListeners(fn) {
        this.onChildLoadListeners.push(fn)
      }
      removeLoadListeners(fn) {
        const index = this.onLoadListeners.findIndex(function (value) {
          return value === fn
        })
        this.onLoadListeners.splice(index, 1)
      }
      removeCompletelyLoadListeners(fn) {
        const index = this.onCompletelyLoadListeners.findIndex(function (value) {
          return value === fn
        })
        this.onCompletelyLoadListeners.splice(index, 1)
      }
      removeChildLoadListeners(fn) {
        const index = this.onChildLoadListeners.findIndex(function (value) {
          return value === fn
        })
        this.onChildLoadListeners.splice(index, 1)
      }
      getSrcArray() {
        return this.contentArray.reduce(function (context, value, index) {
          if (value instanceof Tag) {
            const src = value.attribute["src"]
            if (src != undefined) {
              context.push(src)
            }
          }
          return context;
        }, [])
      }
      addChild(index, src, value) {
        const childNode = new Node(src);
        childNode.text = value;
        childNode.parent = this;
        this.children[index] = childNode;
        //prevent parent nodes being their child's node
        this.pathSet.add(this.path);
        if (this.pathSet.has(src)) {
          childNode.isValide = false;
        }
        this.onChildLoad(index, childNode)
        return childNode;
      }
      onChildLoad(index, child) {
        log(`onChildLoad:${child.parent.path}->[${index}] ${child.path}`);
        this.onChildLoadListeners.forEach(function (listener) {
          listener(child, index)
        })
      }
      onCompletelyLoad(node) { //load its content and its children's content
        log("onCompletelyLoad:" + node.path);
        this.isCompletelyLoad = true;
        this.onCompletelyLoadListeners.forEach(function (listener) {
          listener(node)
        })
      }
      //load its content, not include the content of include content
      onLoad(text) {
        //add content to the node and parse the content
        this.isLoad = true;
        this.text = text;
        log("onLoad:" + this.path);
        this.contentArray = Node.parseHtml("include", this.text)
        //fire listener
        this.onLoadListeners.forEach(function (listener) {
          listener(node)
        })
        //fire completelyLoad event
        if (this.contentArray.length === 1) {//leaf Node
          Node.fireCompletelyLoad(this);
        }
      }
    }
    Node.prototype.pathSet = new Set();
    Node.fireCompletelyLoad = function (node) {
      node.onCompletelyLoad(node);
      if (node.parent) {
        const allLoad = node.parent.children.every(function (v) {
          return v.isCompletelyLoad === true;
        })
        if (allLoad) {
          Node.fireCompletelyLoad(node.parent)
        }
      }
    }
    /**
     *  node with path
     */
    Node.doInclude = function (node) {
      if (!node.isValide) {
        node.onLoad('');
      } else {
        Node.get(node.path, function (value) {
          node.onLoad(value);
          node.getSrcArray().forEach(function (src, index) {
            Node.get(src, function (value) {
              const newNode = node.addChild(index, src, value)
              Node.doInclude(newNode)
            })
          })
        })
      }
    }

    Node.get = function (path, fn) {
      var xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function () {
        if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
          if (fn instanceof Function)
            fn(this.responseText);
        }
      };
      xhttp.open("GET", path + "?time=" + new Date().getTime(), true);
      xhttp.send();
    }

    /**
     * [String,Tag,String,Tag,String]
     */
    Node.parseHtml = function (tagName, source) {
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
        context.push(new Tag(tagName, matchText));
        return context;
      }, [])
      result.push(new String(source.substring(result['LastIndex'])))
      return result;
    };

    Node.treeToString = function (node) {
      if (!(node instanceof Node) || !node.isLoad) return ""
      let i = 0;
      return node.contentArray.reduce(function (context, value, index) {
        if (value instanceof String) {
          context.push(value)
        } else if (value instanceof Tag) {
          const child = Node.treeToString(node.children[i++]);
          context.push(child)
        } else {
          console.assert(false, "unsupported type")
        }
        return context;
      }, []).join("");
    }

    
    Node.load = function (src) {
      const node = new Node(src ? src : window.location.href);
      Node.doInclude(node);
      node.addCompletelyLoadListeners(function (n) {
        const html = Node.treeToString(n)
        document.write(html)
        log(html)
      })
      return node;
    }


    /////////////////////////////////////////////
    let rootNode = null

    function load(src){
      if(rootNode === null){
        rootNode = Node.load(src)
      }
      return window['include']
    }
    function addLoadListeners(fn){
      rootNode.addCompletelyLoadListeners(fn)
      return window['include']
    }
    function removeLoadListeners(fn){
      rootNode.removeCompletelyLoadListeners(fn)
      return window['include']
    }

    window['include'] = {
      load: load,
      addLoadListeners: addLoadListeners,
      removeLoadListeners: removeLoadListeners
    }

    include.load();
  }
})()