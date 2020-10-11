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

var assert = require('assert');
describe('Whisper', function () {
  describe('#demos', function () {
    it('should demo tcp transport, nacl encrypted, 2 peers session', function (done) {
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
          done();
        }, 2)
        bob.on("peer.accept", () => {
          bob.broadcast({type:"message", data :"hello"})

          alice.once("message", (m)=>{
            alice.broadcast({type:"message", data :"yo"})
            wg()
          })
          bob.once("message", wg)
        })
        bob.connect()
        alice.connect()
      })
    });
    it('should demo websocket transport, human readable, 2 peers session', function (done) {
      var port = 11000
      var srv = WsTestServer(port)
      srv.on("listening", ()=>{

        const bob = new Peer(
          new WsTransport(`ws://127.0.0.1:${port}/`),
          new Whisper(NoCrypto, "room id", "room pwd", {handle:"bob"}),
        );
        const alice = new Peer(
          new WsTransport(`ws://127.0.0.1:${port}/`),
          new Whisper(NoCrypto, "room id", "room pwd", {handle:"alice"}),
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

      const bob = new Peer(
        tr.endPoint().connect(),
        new Whisper(NoCrypto, "room id", "room pwd", {handle:"bob"}),
      );
      const alice = new Peer(
        tr.endPoint().connect(),
        new Whisper(NoCrypto, "room id", "room pwd", {handle:"alice"}),
      );

      bob.on("error", console.error)
      alice.on("error", console.error)
      alice.on("peer.accept", (p)=>{
        console.log("alice peer.accept", p.handle)
      })
      bob.once("peer.accept", (p)=>{
        console.log("bob peer.accept", p.handle)
        bob.broadcast({"type": "message", "data":"hello"})
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
    });
    it('should demo all events', function (done) {
      const tr = new ArrayTransportProvider(100)

      const bob = new Peer(
        tr.endPoint().connect(),
        new Whisper(NoCrypto, "room id", "room pwd", {handle:"bob"}),
      );
      const alice = new Peer(
        tr.endPoint().connect(),
        new Whisper(NoCrypto, "room id", "room pwd", {handle:"alice"}),
      );

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
      bob.once("peer.accept", (p)=>{
        bob.broadcast({"type": "message", "data":"hello"})
      })
      alice.once("message", (m)=>{
        console.log("alice message", m)
        assert.equal(m.data, "hello")
      })
      alice.once("peer.accept", (p)=>{
        bob.once("renew.peerhandle", () => {
          bob.disconnect();
          alice.disconnect();
          done();
        })
        alice.changeHandle("tomate")
      })
      bob.connect()
      alice.connect()
    });
    it('should timeout', function (done) {
      this.timeout(5000);
      WhisperOpts.AnnounceTimeout = 1;
      const tr = new ArrayTransportProvider(100)

      const bob = new Peer(
        tr.endPoint().connect(),
        new Whisper(NoCrypto, "room id", "room pwd", {handle:"bob"}),
      );
      const alice = new Peer(
        tr.endPoint().connect(),
        new Whisper(NoCrypto, "room id", "room pwd", {handle:"alice"}),
      );

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
    });
  });
});
