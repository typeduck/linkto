# linkto

  Express middleware: make absolute links from relative paths.

```js
var app = require("express")();
var linkto = require("linkto");
app.set("trust proxy", true);
app.use(linkto());
app.get("/your/path/here", function(req, res, next){
  res.send({otherPath: req.linkto("../../other/path")});
});
```


## Installation

```bash
$ npm install linkto
```

## Features

  - Can preserve URL parameters, all or selectively
  - Works behind reverse HTTP proxy AND locally
  - Can include path stripped by proxy when included in special header
  - Can interpret absolute links as starting at:
    - host: truly absolute
    - proxy: absolute within app, honors proxy indication (default)
    - route: absolute within current route (honors "trust proxy", too)

## Examples

```js
var opts = {
  params: true // links will contain request URL parameters
};
opts = {
  params: ["a", "b"] // include URL parameters 'a' and 'b' from request
};
opts = {
  params: function(k, v){
    return /^a*b$/.test(k); // use a function called for each parameter
  }
};
opts = {
  absolute: "route" // absolute links are anchored to current route
};
opts = {
  absolute: "host" // truly absolute links for domain
};

// pass options when creating middleware
app.use(linkto(opts));

// or override them when calling req.linkto()
app.get("/some/path", function(req, res, next){
  var elsewhere = req.linkto("/other/path", {params: false});
});

// query included in function call? those are always included
app.get("/some/path", function(req, res, next){
  var elsewhere = req.linkto("/other/path?goosebite=sister");
});
```

## More

For links to include the path that is otherwise stripped away behind a proxy,
you have to do two things:

- Be sure to set "trust proxy" in your express application
- Configure your proxy to send the (made up) HTTP Header "X-Forwarded-Path" to
  the backend

Example nginx configuration:

```nginx
server {
  listen 80;
  server_name example.com;

  # portion proxied to the backend
  location /node/js/service {
    rewrite /node/js/service/(.*) /$1 break;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $server_name;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Path /node/js/service;
    proxy_set_header X-Forwarded-Host $host;
  }
}
```
