/**

new Tag() 
new Node()
OnBeforeRequest()
Request()
Load()
OnAfterLoaded()
SetContents()
OnParseContent()
onAfterChildLoaded() —————> new Tag() 
                            new Node()
                            OnBeforeRequest()
                            Request()
                            Load()
                            OnAfterLoad()
                            SetContents()
                            OnParseContent()
                            OnChildAdd() ————————>      new Tag() 
                                                        new Node()
                                                        OnBeforeRequest()
                                                        Request()
                                                        Load()
                                                        OnAfterLoad()
                                                        SetContents()
                                                        OnParseContent()
                                                        OnChildAdd()
OnCompletelyLoad()  <———   OnCompletelyLoad()  <———  OnCompletelyLoad() 

 */



function log() {
  console.log(arguments)
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
  constructor(tag) {
    if (!(tag instanceof Object)) {
      console.assert(false, "tag should is not empty")
    }
    //require value
    this.tag = tag;
    this.parseFunction = null
    this.requestFunction = null
    // this.parseReg = parseReg
    //content
    this.parsedContent = []; //[string,tag,string,tag,string,tag]
    this.content;
    //inherit 
    this.parent;
    this.children = [];  // [node, node, node...]
    //status of the node
    this.isValide = true;
    this.isLoad = false;
    this.LoadedChildrenLength = 0;
    this.isCompletelyLoad = false;
    //listeners
    this.onBeforeRequestListeners = []
    this.onAfterLoadedListeners = []
    this.onAfterChildLoadedListeners = []
    this.onAfterCompletelyLoadedListeners = []
    //init node
    this.doInclude(this);
  }

  doInclude(node) {
    if (!node.isValide) {
      node.onAfterLoaded('');
    } else {
      node.onBeforeRequest(node.tag).request(node, function (content) {
        node.onAfterLoaded(content);
        node.children.forEach(function (child, index) {
          this.doInclude(child)
        })
      })
    }
  }

  addChild(index, requestFunction, parseReg, tag, content) {
    const childNode = new Node(tag, parseReg, tag);
    childNode.content = content;
    childNode.parent = this;
    this.children[index] = childNode;
    //prevent parent nodes being their child's node
    //todo
    this.onAfterChildLoaded(index, childNode)
    return childNode;
  }

  request(node, callback) {
    this.requestFunction(node.tag, function (value) {
      callback(value)
    })
  }

  setRequestFunction(fn) {
    this.requestFunction = fn
  }
  // set requestFunction
  onBeforeRequest(tag) {
    log("onBeforeRequest:" + tag);
    console.assert(this.requestFunction instanceof Function, "requestFunction is required, please call node.setRequestFunction(fn)")
    return this;
  }

  //load its content, not include the content of include content
  onAfterLoaded(content) {
    //add content to the node and parse the content
    this.isLoad = true;
    this.content = content;
    log("onAfterLoaded:" + this.tag);
    this.onParseContent(this.content)
    //fire listener
    this.onLoadListeners.forEach(function (listener) {
      listener(node)
    })
    //fire completelyLoad event
    if (this.contentArray.findIndex(v => { return v instanceof Tag }) < 0) {//leaf Node
      Node.fireCompletelyLoad(this);
    }
  }

  setParseContentFunction(fn) {
    this.parseFunction = fn;
  }

  onParseContent(content) {
    log("onParseContent:" + this.tag);
    console.assert(this.parseFunction instanceof Function, "parseFunction is required, please call node.setParseContentFunction(fn)")
    this.contentArray = this.parseFunction(content)
    let i = 0
    this.children = this.contentArray.reduce(function (context, v) {
      if (v instanceof Tag) {
        const node = new Node(v)
        context.push(node);
        this.onAfterChildLoaded(i, node)
        i++
      }
      return context;
    }, [])
  }

  onAfterChildLoaded(index, child) {
    log(`onAfterChildLoaded: ${node.tag} -> [${index}]`);
    this.onAfterChildLoadedListeners.forEach(function (listener) {
      listener(child, index)
    })
  }

  onAfterCompletelyLoaded(node) { //load its content and its children's content
    log("onAfterCompletelyLoaded:" + node.tag);
    this.isCompletelyLoad = true;
    this.onCompletelyLoadListeners.forEach(function (listener) {
      listener(node)
    })
  }

}


/**
 * [String,Tag,String,Tag,String]
 */
const parseContentFunction = function (reg, source) {
  //const reg = /(<include[^>]*>(.*?)<\s*\/\s*include>|<\s*include[^>]*\/\s*>)/g
  //const reg = new RegExp('(<' + tagName + '[^>]*>(.*?)<\s*\/\s*' + tagName + '>|<\s*' + tagName + '[^>]*\/\s*>)', 'g')
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



const get = function (path, fn) {
  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
      if (fn instanceof Function)
        fn(this.responseText);
    }
  };
  xhttp.open("GET", path + "?time=" + new Date().getTime(), true);
  xhttp.send();
}


const treeToString = function (node) {
  if (!(node instanceof Node) || !node.isLoad) return ""
  let i = 0;
  return node.contentArray.reduce(function (context, value, index) {
    if (value instanceof String) {
      context.push(value)
    } else if (value instanceof Tag) {
      const child = treeToString(node.children[i++]);
      context.push(child)
    } else {
      console.assert(false, "unsupported type")
    }
    return context;
  }, []).join("");
}



const root = `
  root[<include src="node1" />]
`

const node1 = `
  node1[<include src="node2" />,<include src="node3" />]
`

const node2 = `
  node2[<include src="node3" />]
`

const node3 = `
  node3
`
const node4 = `
  node4
`

const node = new Node(new Tag("include",'<include src="node1" />'))
