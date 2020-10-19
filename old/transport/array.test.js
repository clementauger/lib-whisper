const {
  ArrayTransportProvider
} = require("./array")

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
describe('#ArrayTransport', function () {
  it('should trigger connect', function (done) {
    const tr = new ArrayTransportProvider(50);
    const bob = tr.endPoint();
    bob.on("connect", (m) => {
      bob.close()
      done()
    })
    bob.connect()
  });
  it('should trigger disconnect', function (done) {
    const tr = new ArrayTransportProvider(50);
    const bob = tr.endPoint();
    bob.on("connect", (m) => {
      bob.close()
    })
    bob.on("disconnect", done)
    bob.connect()
  });
  it('should write messages', function (done) {
    const tr = new ArrayTransportProvider(50);
    const alice = tr.endPoint();
    const bob = tr.endPoint();
    var wg = waitGroup(()=>{
      bob.close()
      alice.close()
    }, 2)
    bob.on("connect", () => {
      bob.send("hello 2")
    })
    alice.on("connect", () => {
      alice.send("hello")
    })
    bob.on("message", wg)
    alice.on("message", wg)
    var wgd = waitGroup(()=>{
      assert.strictEqual(tr.msgID, 2)
      assert.strictEqual(tr.msgs.length, 2)
      assert.strictEqual(tr.msgs[0].id, 0)
      assert.strictEqual(tr.msgs[0].from, 0)
      assert.strictEqual(tr.msgs[0].data, '"hello"')
      assert.strictEqual(tr.msgs[1].id, 1)
      assert.strictEqual(tr.msgs[1].from, 1)
      assert.strictEqual(tr.msgs[1].data, '"hello 2"')
      done()
    },2)
    bob.on("disconnect", wgd)
    alice.on("disconnect", wgd)
    alice.connect()
    bob.connect()
  });
  it('should broadcast message to other peers', function (done) {
    const tr = new ArrayTransportProvider(50);
    const bob = tr.endPoint();
    const alice = tr.endPoint();
    var aliceMsg = [];
    var bobMsg = [];
    bob.on("connect", () => {
      bob.send("hello")
    })
    alice.on("message", (m) => {
      aliceMsg.push(m)
      alice.close();
      bob.close();
    })
    bob.on("message", (m) => {
      bobMsg.push(m)
    })
    var wg = waitGroup(done, 2);
    alice.on("disconnect", () => {
      assert.strictEqual(aliceMsg.length, 1)
      assert.strictEqual(aliceMsg[0], "hello")
      wg()
    })
    bob.on("disconnect", () => {
      assert.strictEqual(bobMsg.length, 0)
      wg()
    })
    bob.connect()
    alice.connect()
  });
});
