const net = require('net');
const {
  WsTransport, WsTestServer
} = require("./ws")
const WebSocket = require('ws');
const Codec = require("./codec");


function waitGroup(done, n) {
  var i = 0;
  return function(){
    i++;
    if (i === n) {
      done();
    }
  }
}

var assert = require('assert');
var i = 9900;
describe('#WsTransport', function () {
  it('should trigger connect', function (done) {
    var port = i++;
    var url = `ws://127.0.0.1:${port}/`
    var srv = WsTestServer(port)
    srv.on("listening", ()=>{
      const bob = new WsTransport({url});
      bob.on("connect", () => {
        bob.close()
        srv.close()
        done()
      })
      bob.connect()
    })
  });
  it('should trigger disconnect', function (done) {
    var port = i++;
    var url = `ws://127.0.0.1:${port}/`
    var srv = WsTestServer(port)
    srv.on("listening", ()=>{
      const bob = new WsTransport({url});
      bob.on("connect", () => {
        bob.close()
      })
      bob.on("disconnect", () => {
        srv.close()
        done()
      })
      bob.connect()
    })
  });
  it('should write messages', function (done) {
    var port = i++;
    var url = `ws://127.0.0.1:${port}/`
    var srv = WsTestServer(port)
    srv.on("listening", ()=>{
      const alice = new WsTransport({url});
      const bob = new WsTransport({url});
      var alicemsgs = [];
      var bobmsgs = [];
      alice.on("message", (m) => {
        alicemsgs.push(m)
        alice.close()
      })
      bob.on("message", (m) => {
        bobmsgs.push(m)
        bob.close()
      })
      var wgc = waitGroup(()=>{
        alice.send("hello")
        bob.send("hello 2")
      }, 2)
      alice.on("connect", wgc)
      bob.on("connect", wgc)
      var wgd = waitGroup(()=>{
        srv.close()
        done()
      }, 2)
      alice.on("disconnect", wgd)
      bob.on("disconnect", () => {
        assert.strictEqual(alicemsgs.length, 1)
        assert.strictEqual(alicemsgs[0],  "hello 2")
        assert.strictEqual(bobmsgs.length, 1)
        assert.strictEqual(bobmsgs[0],  "hello")
        wgd()
      })
      alice.connect()
      bob.connect()
    })
  });
  it('should broadcast message to other peers', function (done) {
    var port = i++;
    var url = `ws://127.0.0.1:${port}/`
    var srv = WsTestServer(port)
    srv.on("listening", ()=>{
      const alice = new WsTransport({url});
      const bob = new WsTransport({url});
      var aliceMsg = [];
      var bobMsg = [];
      alice.on("message", (m) => {
        aliceMsg.push(m)
        alice.close()
      })
      bob.on("message", (m) => {
        bobMsg.push(m)
        bob.close()
      })
      var wgc = waitGroup(()=>{
        alice.send("hello")
        bob.send("hello 2")
      }, 2)
      alice.on("connect", wgc)
      bob.on("connect", wgc)
      var wgd = waitGroup(()=>{
        srv.close()
        done()
      }, 2);
      alice.on("disconnect", () => {
        assert.strictEqual(aliceMsg.length, 1)
        assert.strictEqual(aliceMsg[0], "hello 2")
        wgd()
      })
      bob.on("disconnect", () => {
        assert.strictEqual(bobMsg.length, 1)
        assert.strictEqual(bobMsg[0], "hello")
        wgd()
      })
      alice.connect()
      bob.connect()
    })
  });
  it('should work with MsgPack', function (done) {
    var port = i++;
    var url = `ws://127.0.0.1:${port}/`
    var codec = Codec.MsgPack;
    var srv = WsTestServer(port)
    srv.on("listening", ()=>{
      const alice = new WsTransport({url, codec});
      const bob = new WsTransport({url, codec});
      var aliceMsg = [];
      var bobMsg = [];
      alice.on("message", (m) => {
        aliceMsg.push(m)
        alice.close()
      })
      bob.on("message", (m) => {
        bobMsg.push(m)
        bob.close()
      })
      var wgc = waitGroup(()=>{
        alice.send("hello")
        bob.send("hello 2")
      }, 2)
      alice.on("connect", wgc)
      bob.on("connect", wgc)
      var wgd = waitGroup(()=>{
        srv.close()
        done()
      }, 2);
      alice.on("disconnect", () => {
        assert.strictEqual(aliceMsg.length, 1)
        assert.strictEqual(aliceMsg[0], "hello 2")
        wgd()
      })
      bob.on("disconnect", () => {
        assert.strictEqual(bobMsg.length, 1)
        assert.strictEqual(bobMsg[0], "hello")
        wgd()
      })
      alice.connect()
      bob.connect()
    })
  });
});
