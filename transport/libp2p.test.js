var wtf = require('wtfnode');
const net = require('net');
const {
  LibP2PTransport
} = require("./libp2p")
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
describe('#LibP2PTransport', function () {
  it('should trigger connect', function (done) {
    var port = i++;
    var codec = Codec.Json;
    const bob = new LibP2PTransport({codec});
    bob.on("connect", async () => {
      bob.close()
      done()
    })
    bob.connect()
  });
  it('should trigger disconnect', function (done) {
    var port = i++;
    var codec = Codec.Json;
    const bob = new LibP2PTransport({codec});
    bob.on("connect", async () => {
      await bob.close()
    })
    bob.on("disconnect", done)
    bob.connect()
  });
  it('should write messages', function (done) {
    this.timeout(5000)
    var port = i++;
    var codec = Codec.Json;
    const alice = new LibP2PTransport({codec});
    const bob = new LibP2PTransport({codec});
    var alicemsgs = [];
    var bobmsgs = [];

    var wg = waitGroup(async ()=>{
      await alice.close()
      await bob.close()
      assert.strictEqual(alicemsgs.length, 2)
      assert.strictEqual(alicemsgs[0],  "hello 2")
      assert.strictEqual(alicemsgs[1],  "hello 4")
      assert.strictEqual(bobmsgs.length, 2)
      assert.strictEqual(bobmsgs[0],  "hello")
      assert.strictEqual(bobmsgs[1],  "hello 3")
      done()
    }, 4)
    alice.on("message", (m) => {
      alicemsgs.push(m)
      wg()
    })
    bob.on("message", (m) => {
      bobmsgs.push(m)
      wg()
    })

    var wg2 = waitGroup(()=>{
      alice.send("hello")
      bob.send("hello 2")
      alice.send("hello 3")
      bob.send("hello 4")
    }, 2)
    alice.once("peer", wg2)
    bob.once("peer", wg2)

    bob.connect()
    alice.connect()
  });
  it('should write messages after a peer disconncted', function (done) {
    this.timeout(5000)
    var port = i++;
    var codec = Codec.Json;
    const alice = new LibP2PTransport({codec});
    const bob = new LibP2PTransport({codec});
    const peter = new LibP2PTransport({codec});
    var alicemsgs = [];
    var bobmsgs = [];
    var petermsgs = [];

    var wg = waitGroup(async ()=>{
      await alice.close()
      await peter.close()
      assert.strictEqual(alicemsgs.length, 0)
      assert.strictEqual(bobmsgs.length, 1)
      assert.strictEqual(bobmsgs[0],  "hello")
      assert.strictEqual(petermsgs.length, 2)
      assert.strictEqual(petermsgs[0],  "hello")
      assert.strictEqual(petermsgs[1],  "hello 2")
      done()
    }, 3)
    alice.on("message", async (m) => {
      alicemsgs.push(m)
    })
    bob.on("message", async (m) => {
      bobmsgs.push(m)
      await bob.close()
      setTimeout(()=>{
        alice.send("hello 2")
        wg()
      }, 100)
    })
    peter.on("message", (m) => {
      petermsgs.push(m)
      wg()
    })

    var wg2 = waitGroup(()=>{
      alice.send("hello")
    }, 3)
    alice.once("peer", wg2)
    bob.once("peer", wg2)
    peter.once("peer", wg2)

    bob.connect()
    alice.connect()
    peter.connect()
  });
  it('should work with MsgPack', function (done) {
    this.timeout(5000)
    var port = i++;
    var codec = Codec.MsgPack;
    const alice = new LibP2PTransport({codec});
    const bob = new LibP2PTransport({codec});
    var alicemsgs = [];
    var bobmsgs = [];

    var wg = waitGroup(async ()=>{
      await alice.close()
      await bob.close()
      assert.strictEqual(alicemsgs.length, 1)
      assert.strictEqual(alicemsgs[0],  "hello 2")
      assert.strictEqual(bobmsgs.length, 1)
      assert.strictEqual(bobmsgs[0],  "hello")
      done()
    }, 2)
    alice.on("message", (m) => {
      alicemsgs.push(m)
      wg()
    })
    bob.on("message", (m) => {
      bobmsgs.push(m)
      wg()
    })

    var wg2 = waitGroup(()=>{
      alice.send("hello")
      bob.send("hello 2")
    }, 2)
    alice.once("peer", wg2)
    bob.once("peer", wg2)

    bob.connect()
    alice.connect()
  });
});
