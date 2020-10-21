const { ArrayTransportProvider } = require("./transport/array")
const { TcpTransport, TcpTestServer } = require("./transport/tcp")
const { WsTransport, WsTestServer } = require("./transport/ws")
const { Whisper, WhisperOpts, Crypters } = require("./whisper")
const { Peer } = require("./peer")
const { CryptoTransport } = require("./cryptotransport")
const Codec = require("./transport/codec");

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

const debug = false;
const codec = Codec.Json;
const port = 10000
const addr = "127.0.0.1";

const srv = TcpTestServer({port, binary: codec.binary})
srv.on("listening", async ()=>{
  async function newPeer(handle){
    const crypter = Crypters.NoCrypto
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

  const bob = await newPeer("bob");
  const alice = await newPeer("alice");
  const peter = await newPeer("peter");
  const dup = await newPeer("peter");

  if(debug){
    bob.on("debug", (info)=>{
      console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
    })
    alice.on("debug", (info)=>{
      console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
    })
    peter.on("debug", (info)=>{
      console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
    })
    dup.on("debug", (info)=>{
      console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
    })
  }

  const wg = waitGroup(()=>{
    console.log("")
    console.log("Done, peers accepted each others.")
    console.log("")
    setTimeout( () => {
      bob && bob.disconnect()
      alice && alice.disconnect()
      peter && peter.disconnect()
      dup && dup.disconnect()
      srv.close()
    }, 500)
  }, 12)

  bob && bob.on("peer.accept", (peer) => { console.log("bob peer.accept", peer)})
  alice && alice.on("peer.accept", (peer) => { console.log("alice peer.accept", peer)})
  peter && peter.on("peer.accept", (peer) => { console.log("peter peer.accept", peer)})
  dup && dup.on("dup.accept", (peer) => { console.log("dup peer.accept", peer)})

  bob && bob.on("peer.accept", wg)
  alice && alice.on("peer.accept", wg)
  peter && peter.on("peer.accept", wg)
  dup && dup.on("peer.accept", wg)

  bob && bob.on("peer.leave", (peer) => { console.log("bob peer.leave", peer)})
  alice && alice.on("peer.leave", (peer) => { console.log("alice peer.leave", peer)})
  peter && peter.on("peer.leave", (peer) => { console.log("peter peer.leave", peer)})
  dup && dup.on("dup.leave", (peer) => { console.log("dup peer.leave", peer)})

  bob && bob.on("renew.myhandle", (newHandle) => { console.log("bob renew.myhandle", newHandle)})
  alice && alice.on("renew.myhandle", (newHandle) => { console.log("alice renew.myhandle", newHandle)})
  peter && peter.on("renew.myhandle", (newHandle) => { console.log("peter renew.myhandle", newHandle)})
  dup && dup.on("renew.myhandle", (newHandle) => { console.log("dup renew.myhandle", newHandle)})

  bob && bob.on("renew.peerhandle", (peer,oldHandle) => { console.log("bob renew.peerhandle oldHandle", oldHandle, "peer", peer)})
  alice && alice.on("renew.peerhandle", (peer,oldHandle) => { console.log("alice renew.peerhandle oldHandle", oldHandle, "peer", peer)})
  peter && peter.on("renew.peerhandle", (peer,oldHandle) => { console.log("peter renew.peerhandle oldHandle", oldHandle, "peer", peer)})
  dup && dup.on("renew.peerhandle", (peer,oldHandle) => { console.log("dup renew.peerhandle oldHandle", oldHandle, "peer", peer)})

  bob && bob.on("message", (m, p)=>{ console.log("bob rcv:", m, "from", p.handle); })
  alice && alice.on("message", (m, p)=>{ console.log("alice rcv:", m, "from", p.handle); })
  peter && peter.on("message", (m, p)=>{ console.log("peter rcv:", m, "from", p.handle); })
  dup && dup.on("message", (m, p)=>{ console.log("dup rcv:", m, "from", p.handle); })

  bob && bob.on("peer.accept", ()=>{bob.broadcast({type:"message", data :"hi"}) })
  alice && alice.on("peer.accept", ()=>{alice.broadcast({type:"message", data :"yo"}) })
  peter && peter.on("peer.accept", ()=>{peter.broadcast({type:"message", data :"hola"}) })
  dup && dup.on("peer.accept", ()=>{dup.broadcast({type:"message", data :"hello"}) })

  bob && bob.connect()
  alice && alice.connect()
  peter && peter.connect()
  dup && dup.connect()
})
