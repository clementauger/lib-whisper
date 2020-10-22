# lib-whisper

Secure chat library.

It transports data over libp2p, tcp/websocket servers.

It encodes data using MsgPack, JSON.

It encrypts messages using NaCl, OpenPGP.

# install

`npm i git+https://github.com/clementauger/lib-whisper.git`

# Usage

```js
const { TcpTransport, TcpTestServer } = require("lib-whisper/transport/tcp")
// const { WsTransport, WsTestServer } = require("lib-whisper/transport/ws")
const { Whisper } = require("lib-whisper/whisper")
const { Peer } = require("lib-whisper/peer")
const { CryptoTransport } = require("lib-whisper/cryptotransport")
const Codec = require("lib-whisper/transport/codec");
const { NoCrypto } = require("lib-whisper/crypto/nocrypto")
// const { Nacl } = require("lib-whisper/crypto/nacl")
// const { Pgp } = require("lib-whisper/crypto/pgp")
// const { SaltShaker } = require("lib-whisper/crypto/saltshaker")

function waitGroup(done, n) {
  var i = 0;
  var ret = function(){
    i++;
    if (i === n) {
      setTimeout(done,0);
    }
  }
  return ret
}

const debug = [];
// const debug = ["alice", "bob"];
const codec = Codec.Json;
const port = 10000
const addr = "127.0.0.1";

const srv = TcpTestServer({port, binary: codec.binary})
srv.on("listening", async ()=>{

  async function newPeer(handle){
    const crypter = NoCrypto
    const keys = await crypter.create()
    const shared = await crypter.create()
    return new Peer(
      new Whisper({
        transport: new CryptoTransport({
          crypter:crypter, keys:keys, shared:shared,
          transport:new TcpTransport({port, addr, codec})
        }),
        roomID: "room id",
        roomPwd: "room pwd",
        handle: handle,
        keys:keys,
        shared:shared,
      }),
    );
  }

  const peers = [
    await newPeer("bob"),
    await newPeer("alice"),
    await newPeer("peter"),
    await newPeer("peter"),
  ]

  const isHandle = function () {
    var handles = Array.from(arguments);
    return (p) => {
      return (handles.length==1&&handles[0]==="*") || handles.length==0 || handles.indexOf(p.handle())>-1;
    }
  }

  debug.length && peers.filter(isHandle.apply(null,debug)).map((p)=>{
    p.on("debug", (info)=>{
      console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
    })
  })

  const wg = waitGroup(()=>{
    console.log("")
    console.log("peers accepted each others.")
    console.log("")
  }, 12) // 4 peers accept 3 other peers.

  const wg2 = waitGroup(()=>{
    console.log("")
    console.log("peers helloed each others.")
    console.log("")
    setTimeout( () => {
      peers.map((p)=>{ p.disconnect() })
      srv.close()
    }, 1500)
  }, 20) // should be 36 (4 peers, rcv 3 hello, from other 3 peers. 4*3*3),
  // though because one peer has duplicate handle, it is unclear how many
  // hello will be exchanged.

  peers.filter(isHandle()).map((p)=>{
    p.on("peer.accept", wg)
    p.on("message", wg2)

    p.on("message", (m, peer)=>{ console.log(p.handle(), "rcv:", m, "from", peer.handle); })
    p.on("peer.accept", (peer) => { console.log(p.handle(), "peer.accept", peer)})
    p.on("peer.leave", (peer) => { console.log(p.handle(), "peer.leave", peer.handle)})
    p.on("renew.myhandle", (newHandle) => { console.log(p.handle(), "renew.myhandle", newHandle)})
    p.on("renew.peerhandle", (peer,oldHandle) => { console.log(p.handle(), "renew.peerhandle", oldHandle, "peer",peer.handle)})
    p.on("peer.accept", (peer)=>{p.broadcast({type:"message", data :"hi "+peer.handle+"!"}) })
  })

  peers.map((p)=>{
    p.connect()
  })
})
```
