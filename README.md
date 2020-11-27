# Include
include is js lib which can include a html in a html.

# Quick start

```js
<script src="include.js"></script>

//do nothing just add an include tag in your html page
<include src="components/a.html"></include>

//or specify the page as the root page to load 
include.load("components/a.html");

//load current page and add event listen
include.load().addLoadListeners(function(node){
    console.log("All include page has been loaded")
})

```

# Example

### index.html
```js
<script src="include.js"></script>
root[<include src="components/a.html"></include>]
```
### a.html
```js
<script src="include.js"></script>
a[<include src="components/b.html"></include>,<include src="components/c.html"></include>,<include src="components/e.html" /></include>]
```
### b.html
```js
b
```
### c.html
```js
c[<include src="components/d.html"></include>]
```
### d.html
```js
d[<include src="components/c.html"></include>]
```
### e.html
```js
e
```

## Output in the index.html
```js
root[a[b,c[d[]],e]]
```
