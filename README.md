# lib-whisper

Secure chat library. NaCl, OpenPGP, Websocket, TCP, MsgPack, JSON.

Not P2P, best suited for hosted tcp/ws socket. On Tor for example.

Otherwise, it might support wild transports,
like private message section of any website it is possible to automate.

# install

`npm i git+https://github.com/clementauger/lib-whisper.git`

# Usage

```js
const {
  Nacl
} = require("lib-whisper/crypto/nacl")
const {
  NoCrypto
} = require("lib-whisper/crypto/nocrypto")
const {
  ArrayTransportProvider
} = require("lib-whisper/transport/array")
const {
  TcpTransport, TcpTestServer
} = require("lib-whisper/transport/tcp")
const {
  WsTransport, WsTestServer
} = require("lib-whisper/transport/ws")
const {
  Whisper, WhisperOpts
} = require("lib-whisper/whisper")
const {
  Peer
} = require("lib-whisper/peer")

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
