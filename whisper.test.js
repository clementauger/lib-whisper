const { ArrayTransportProvider } = require("./transport/array")
const { LibP2PTransport } = require("./transport/libp2p")
const { TcpTransport, TcpTestServer } = require("./transport/tcp")
const { WsTransport, WsTestServer } = require("./transport/ws")
const { Whisper, MsgType, Crypters, SumHash } = require("./whisper")
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

var assert = require('assert');
var sport = 10000
const addr = "127.0.0.1"
describe('Whisper', function () {
  describe('#demos', function () {
    it('should demo tcp transport, nacl encrypted, 2 peers session, msgpack codec', function (done) {
      const port = sport++;
      const debug = false;
      const codec = Codec.MsgPack;
      const srv = TcpTestServer({port, binary: codec.binary})
      srv.on("listening", async ()=>{

        async function newPeer(handle){
          const crypter = Crypters.Nacl
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

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          srv.close()
          done();
        }, 2)
        bob.on("peer.accept", () => {
          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
          bob.broadcast({type:"message", data :"hello"})
        })
        alice.connect()
        bob.connect()
      })
    });
    it('should demo tcp transport, nacl encrypted, 2 peers session, json codec', function (done) {
      const port = sport++;
      const debug = false;
      const codec = Codec.Json;
      const srv = TcpTestServer({port, binary: codec.binary})
      srv.on("listening", async ()=>{

        async function newPeer(handle){
          const crypter = Crypters.Nacl
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

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          srv.close()
          done();
        }, 2)
        bob.on("peer.accept", () => {
          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
          bob.broadcast({type:"message", data :"hello"})
        })
        alice.connect()
        bob.connect()
      })
    });
    it('should demo tcp transport, SaltShaker encrypted, 2 peers session', function (done) {
      const port = sport++;
      const codec = Codec.Json;
      const debug = false;
      const srv = TcpTestServer({port, binary: codec.binary})
      srv.on("listening", async ()=>{

        async function newPeer(handle){
          const crypter = Crypters.SaltShaker
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

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          srv.close()
          done();
        }, 2)
        bob.on("peer.accept", () => {
          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
          bob.broadcast({type:"message", data :"hello"})
        })
        alice.connect()
        bob.connect()
      })
    });
    it('should demo tcp transport, Pgp encrypted, 2 peers session', function (done) {
      const port = sport++;
      const debug = false;
      this.timeout(5000)
      const codec = Codec.Json;
      const srv = TcpTestServer({port, binary: codec.binary})
      srv.on("listening", async ()=>{

        async function newPeer(handle){
          const crypter = Crypters.Pgp
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

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          srv.close()
          done();
        }, 2)
        bob.on("peer.accept", () => {
          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
          bob.broadcast({type:"message", data :"hello"})
        })
        alice.connect()
        bob.connect()
      })
    });
    it('should demo libp2p transport, Pgp encrypted, 2 peers session', function (done) {
      const port = sport++;
      const debug = false;
      this.timeout(10000)
      const codec = Codec.Json;

      (async () => {
        async function newPeer(handle){
          const crypter = Crypters.Pgp
          const keys = await crypter.create()
          const shared = await crypter.create()
          return new Peer(
            new Whisper({
              transport: new CryptoTransport({
                crypter:crypter, keys:keys, shared:shared,
                transport: new LibP2PTransport({codec})
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

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          done();
        }, 2)
        alice.once("message", wg)
        bob.once("message", wg)

        var wg2 = waitGroup(()=>{
          bob.broadcast({type:"message", data :"hello"})
          alice.broadcast({type:"message", data :"yo"})
        }, 2)
        bob.once("peer.accept", wg2)
        alice.once("peer.accept", wg2)
        alice.connect()
        bob.connect()
      })();
    });
    it('should demo websocket transport, human readable, 2 peers session', function (done) {
      const port = sport++;
      const codec = Codec.Json;
      const debug = false;
      const url = `ws://127.0.0.1:${port}/`;
      const srv = WsTestServer(port)
      srv.on("listening", async ()=>{

        async function newPeer(handle){
          const crypter = Crypters.NoCrypto
          const keys = await crypter.create()
          const shared = await crypter.create()
          return new Peer(
            new Whisper({
              transport: new CryptoTransport({
                crypter:crypter, keys:keys, shared:shared,
                transport:new WsTransport({url, codec})
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

        if (debug) {
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          srv.close()
          done();
        }, 2)

        bob.connect()
        alice.connect()

        bob.on("peer.accept", () => {
          bob.broadcast({type:"message", data :"hello"})

          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
        })
      })
    });
    it('should demo websocket transport, human readable, 2 peers session, msgpack codec', function (done) {
      const port = sport++;
      const codec = Codec.MsgPack;
      const debug = false;
      const url = `ws://127.0.0.1:${port}/`;
      const srv = WsTestServer(port)
      srv.on("listening", async ()=>{

        async function newPeer(handle){
          const crypter = Crypters.NoCrypto
          const keys = await crypter.create()
          const shared = await crypter.create()
          return new Peer(
            new Whisper({
              transport: new CryptoTransport({
                crypter:crypter, keys:keys, shared:shared,
                transport:new WsTransport({url, codec})
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

        if (debug) {
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(()=>{
          bob.disconnect()
          alice.disconnect()
          srv.close()
          done();
        }, 2)

        bob.connect()
        alice.connect()

        bob.on("peer.accept", () => {
          bob.broadcast({type:"message", data :"hello"})

          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
        })
      })
    });
    it('should demo array transport, human readable, 2 peers session', function (done) {
      const tr = new ArrayTransportProvider(100)
      const debug = false;
      ( async ()=>{
        async function newPeer(handle){
          const crypter = Crypters.NoCrypto
          const keys = await crypter.create()
          const shared = await crypter.create()
          return new Peer(
            new Whisper({
              transport: new CryptoTransport({
                crypter:crypter, keys:keys, shared:shared,
                transport:tr.endPoint()
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

        if (debug) {
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        bob.on("error", console.error)
        alice.on("error", console.error)
        const wg = waitGroup(()=>{
          bob.broadcast({"type": "message", "data":"hello"})
        }, 2)
        alice.on("peer.accept", (p)=>{
          console.log("alice peer.accept", p.handle)
          wg()
        })
        bob.once("peer.accept", (p)=>{
          console.log("bob peer.accept", p.handle)
          wg()
        })
        alice.once("message", (m)=>{
          console.log("alice message", m)
          assert.equal(m.data, "hello")
          bob.disconnect();
          alice.disconnect();
          done();
        })
        bob.connect()
        alice.connect()
      })();
    });
    it('should demo all events', function (done) {
      const port = sport++;
      const debug = false;
      const codec = Codec.MsgPack;
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

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        bob.on("disconnect", ()=>{
          console.log("bob disconnect")
        })
        alice.on("disconnect", ()=>{
          console.log("alice disconnect")
        })

        bob.on("negotiating", (n)=>{
          console.log("bob negotiating", n)
        })
        alice.on("negotiating", (n)=>{
          console.log("alice negotiating", n)
        })
        bob.on("error", (err)=>{
          console.log("bob error", err)
        })
        alice.on("error", (err)=>{
          console.log("alice error", err)
        })
        bob.on("renew.peerhandle", (peer, oldHandle)=>{
          console.log("bob peer", oldHandle, "renames to", peer.handle)
        })
        alice.on("renew.peerhandle", (peer, oldHandle)=>{
          console.log("alice peer", oldHandle, "renames to", peer.handle)
        })
        bob.on("renew.myhandle", (newHandle)=>{
          console.log("bob renames to", newHandle)
        })
        alice.on("renew.myhandle", (newHandle)=>{
          console.log("alice renames to", newHandle)
        })
        bob.on("accept", ()=>{
          console.log("bob accept")
        })
        alice.on("accept", ()=>{
          console.log("alice accept")
        })
        bob.on("peer.accept", (p)=>{
          console.log("bob peer.accept", p.handle)
        })
        alice.on("peer.accept", (p)=>{
          console.log("alice peer.accept", p.handle)
        })
        bob.on("peer.leave", (p)=>{
          console.log("bob peer.leave", p)
        })
        alice.on("peer.leave", (p)=>{
          console.log("alice peer.leave", p)
        })
        bob.once("peer.accept", (p)=>{
          console.log("BOB broadcast")
          bob.broadcast({"type": "message", "data":"hello"})
        })
        alice.once("message", (m)=>{
          console.log("alice message", m)
          assert.equal(m.data, "hello")
        })
        alice.once("peer.accept", (p)=>{
          bob.once("renew.peerhandle", async () => {
            await bob.disconnect();
            console.log("bob left")
            setTimeout( async () => {
              await alice.disconnect();
              srv.close()
              done();
            }, 2500)
          })
          alice.changeHandle("tomate")
        })
        console.log("start")
        this.timeout(10000)
        bob.connect()
        alice.connect()

      })
    });
    it('should timeout', function (done) {
      const debug = false;
      this.timeout(5000);
      const tr = new ArrayTransportProvider(100);
      ( async ()=>{
        async function newPeer(handle){
          const crypter = Crypters.NoCrypto
          const keys = await crypter.create()
          const shared = await crypter.create()
          return new Peer(
            new Whisper({
              transport: new CryptoTransport({
                crypter:crypter, keys:keys, shared:shared,
                transport:tr.endPoint()
              }),
              roomID: "room id",
              roomPwd: "room pwd",
              handle: handle,
              keys:keys,
              shared:shared,
              opts: {AnnounceTimeout: 1},
            }),
          );
        }
        const bob = await newPeer("bob");
        const alice = await newPeer("alice");

        if(debug){
          bob.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        bob.on("error", console.error)
        alice.on("error", console.error)
        var wg = waitGroup(()=>{
          alice.disconnect()
          bob.once("peer.leave", (p)=>{
            console.log("bob peer.leave", p)
            bob.disconnect();
            done();
          })
        },2)
        alice.on("peer.accept", (p)=>{
          console.log("alice peer.accept", p.handle)
          wg()
        })
        bob.once("peer.accept", (p)=>{
          console.log("bob peer.accept", p.handle)
          wg()
        })
        bob.connect()
        alice.connect()
      })();
    });
  });
  describe('#bad acting', function () {
    it('should ignore invalid announce message', function (done) {
      this.timeout(5000);
      const debug = !true;
      const port = sport++;
      const codec = Codec.Json;
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
              opts: {AnnounceTimeout: 200, AnnounceInterval: 1000, LoginRetry:1},
            }),
          );
        }
        const bob = await newPeer("bob");
        const alice = await newPeer("alice");
        const peter = await newPeer("peter");

        if (debug) {
          peter.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          alice.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
          peter.on("debug", (info)=>{
            console.log(`${info.handle} ${info.dir} ${info.type} ${JSON.stringify(info.data)}`)
          })
        }

        var wg = waitGroup(async ()=>{
          console.log("alice bad acting")
          // alice is bad acting,
          // she slips trhough the peter's announce message.
          // peter.whisper.me.keys = await peter.whisper.transport._crypter.create()
          var msg = await peter.whisper._announcePkt();
          msg.sign = await peter.whisper.transport._crypter.sign(msg.data)
          var wg = waitGroup(()=>{
            bob.disconnect()
            alice.disconnect()
            peter.disconnect()
            srv.close()
            done();
          }, 3)
          peter.once("peer.accept", (peer) =>{
            console.log("peter peer accept", peer)
            wg()
          })
          alice.once("peer.accept", (peer) =>{
            console.log("alice peer accept", peer)
            wg()
          })
          bob.once("peer.accept", (peer) =>{
            console.log("bob peer accept", peer)
            wg()
          })
          alice.whisper.transport._transport.send(msg)
          console.log("peter connect", peter.whisper.publicKey())
          peter.connect()
        }, 2)
        alice.once("peer.accept", wg)
        bob.once("peer.accept", wg)
        bob.connect()
        alice.connect()
      })
    });
  });
});
