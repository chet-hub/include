## Include
Include is javascript lib which can include a html in a html. 
The most important feature of this lib is that you can include a file which has the ability to include another file, it means the include action is recursive.


## Quick start

```html
<script src="include.js"></script>
//do nothing just add an include tag in your html page
<include src="components/a.html"></include>
```
Or
```html
<script src="include.js"></script>
<script>
//specify the page as the root page to load 
include.load("components/a.html");
</script>
```
Or
```html
<script src="include.js"></script>
<script>
//load current page and add event listener
include.load().addLoadListeners(function(node){
    console.log("All include page has been loaded")
})
</script>
```

## Example

### index.html
```html
<script src="include.js"></script>
root[<include src="components/a.html"></include>]
```
### a.html
```html
<script src="include.js"></script>
a[<include src="components/b.html"></include>,<include src="components/c.html"></include>,<include src="components/e.html" /></include>]
```
### b.html
```html
b
```
### c.html
```html
c[<include src="components/d.html"></include>]
```
### d.html
```html
d[<include src="components/c.html"></include>]
```
### e.html
```html
e
```

## Output 
open index.html with chrome
```html
root[a[b,c[d[]],e]]
```