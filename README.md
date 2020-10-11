# lib-whisper

Secure chat library.

# install

`npm i git+https://github.com/clmentauger/lib-whisper`

# Usage

```js
const {
  Nacl
} = require("./crypto/nacl")
const {
  NoCrypto
} = require("./crypto/nocrypto")
const {
  ArrayTransportProvider
} = require("./transport/array")
const {
  TcpTransport, TcpTestServer
} = require("./transport/tcp")
const {
  WsTransport, WsTestServer
} = require("./transport/ws")
const {
  Whisper, WhisperOpts
} = require("./whisper")
const {
  Peer
} = require("./peer")

function waitGroup(done, n) {
  var i = 0;
  var then = null;
  var ret = function(){
    i++;
    if (i === n) {
      done();
      if (then) then();
    }
  }
  ret.then = (t)=>{then=t;}
  return ret
}

var port = 10000
var srv = TcpTestServer(port)
srv.on("listening", ()=>{

  const bob = new Peer(
    new TcpTransport(port, "127.0.0.1"),
    new Whisper(Nacl, "room id", "room pwd", {handle:"bob"}),
  );
  const alice = new Peer(
    new TcpTransport(port, "127.0.0.1"),
    new Whisper(Nacl, "room id", "room pwd", {handle:"alice"}),
  );

  bob.on("debug", (info)=>{
    console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
  })
  alice.on("debug", (info)=>{
    console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
  })
  var wg = waitGroup(()=>{
    bob.disconnect()
    alice.disconnect()
    srv.close()
  }, 2)
  bob.on("peer.accept", () => {
    alice.once("message", (m)=>{
      console.log(m);
      alice.broadcast({type:"message", data :"yo"})
      wg()
    })
    bob.once("message", (m)=>{
      console.log(m);
      wg()
    })
    bob.broadcast({type:"message", data :"hello"})
  })
  bob.connect()
  alice.connect()
})
```
