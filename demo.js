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
  const peter = new Peer(
    new TcpTransport(port, "127.0.0.1"),
    new Whisper(Nacl, "room id", "room pwd", {handle:"peter"}),
  );
  const dup = new Peer(
    new TcpTransport(port, "127.0.0.1"),
    new Whisper(Nacl, "room id", "room pwd", {handle:"peter"}),
  );

  // bob.on("debug", (info)=>{
  //   console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
  // })
  // alice.on("debug", (info)=>{
  //   console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
  // })
  // peter.on("debug", (info)=>{
  //   console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
  // })
  // dup.on("debug", (info)=>{
  //   console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
  // })
  var wg = waitGroup(()=>{
    peter.disconnect()
    dup.disconnect()
    bob.disconnect()
    alice.disconnect()
    srv.close()
  }, 12)
  bob.on("peer.accept", (peer) => { console.log("bob peer.accept", peer)})
  alice.on("peer.accept", (peer) => { console.log("alice peer.accept", peer)})
  peter.on("peer.accept", (peer) => { console.log("peter peer.accept", peer)})
  dup.on("dup.accept", (peer) => { console.log("dup peer.accept", peer)})

  bob.on("peer.leave", (peer) => { console.log("bob peer.leave", peer)})
  alice.on("peer.leave", (peer) => { console.log("alice peer.leave", peer)})
  peter.on("peer.leave", (peer) => { console.log("peter peer.leave", peer)})
  dup.on("dup.leave", (peer) => { console.log("dup peer.leave", peer)})

  bob.on("renew.myhandle", (newHandle) => { console.log("bob renew.myhandle", newHandle)})
  alice.on("renew.myhandle", (newHandle) => { console.log("alice renew.myhandle", newHandle)})
  peter.on("renew.myhandle", (newHandle) => { console.log("peter renew.myhandle", newHandle)})
  dup.on("renew.myhandle", (newHandle) => { console.log("dup renew.myhandle", newHandle)})

  bob.on("renew.peerhandle", (peer,oldHandle) => { console.log("bob renew.peerhandle oldHandle", oldHandle, "peer", peer)})
  alice.on("renew.peerhandle", (peer,oldHandle) => { console.log("alice renew.peerhandle oldHandle", oldHandle, "peer", peer)})
  peter.on("renew.peerhandle", (peer,oldHandle) => { console.log("peter renew.peerhandle oldHandle", oldHandle, "peer", peer)})
  dup.on("renew.peerhandle", (peer,oldHandle) => { console.log("dup renew.peerhandle oldHandle", oldHandle, "peer", peer)})

  alice.on("message", (m, p)=>{ console.log("alice rcv:", m, "from", p.handle); })
  bob.on("message", (m, p)=>{ console.log("bob rcv:", m, "from", p.handle); })
  peter.on("message", (m, p)=>{ console.log("peter rcv:", m, "from", p.handle); })
  dup.on("message", (m, p)=>{ console.log("dup rcv:", m, "from", p.handle); })

  bob.on("peer.accept", ()=>{bob.broadcast({type:"message", data :"hi"}) })
  alice.on("peer.accept", ()=>{alice.broadcast({type:"message", data :"yo"}) })
  dup.on("peer.accept", ()=>{dup.broadcast({type:"message", data :"hello"}) })
  peter.on("peer.accept", ()=>{peter.broadcast({type:"message", data :"hola"}) })

  bob.on("peer.accept", wg)
  alice.on("peer.accept", wg)
  dup.on("peer.accept", wg)
  peter.on("peer.accept", wg)

  bob.connect()
  alice.connect()
  peter.connect()
  dup.connect()
})
