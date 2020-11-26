# include
include a html in a html

# quick start
```
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

