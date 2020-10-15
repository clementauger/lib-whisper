const net = require('net');
const {
  TcpTransport, TcpTestServer
} = require("./tcp")
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
var i = 9000;
var addr = "127.0.0.1";
describe('#TcpTransport', function () {
  it('should trigger connect', function (done) {
    var port = i++;
    var codec = Codec.Json;
    var srv = TcpTestServer({port, binary:codec.binary})
    srv.on("listening", ()=>{
      const bob = new TcpTransport({port, addr});
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
    var codec = Codec.Json;
    var srv = TcpTestServer({port, binary:codec.binary})
    srv.on("listening", ()=>{
      const bob = new TcpTransport({port, addr});
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
    var codec = Codec.Json;
    var srv = TcpTestServer({port, binary:codec.binary})
    srv.on("listening", ()=>{
      const alice = new TcpTransport({port, addr});
      const bob = new TcpTransport({port, addr});
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
    var codec = Codec.Json;
    var srv = TcpTestServer({port, binary:codec.binary})
    srv.on("listening", ()=>{
      const alice = new TcpTransport({port, addr});
      const bob = new TcpTransport({port, addr});
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
    var codec = Codec.MsgPack;
    var srv = TcpTestServer({port, binary:codec.binary})
    srv.on("listening", ()=>{
      const alice = new TcpTransport({port, addr, codec});
      const bob = new TcpTransport({port, addr, codec});
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
