const {
  Nacl
} = require("./nacl")
const {
  NoCrypto
} = require("./nocrypto")

var nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

var assert = require('assert');
describe('Crypto', function () {
  var providers = {Nacl, NoCrypto}
  const k = nacl.box.keyPair();
  var keys = {
    Nacl: {
        publicKey: nacl.util.encodeBase64(k.publicKey),
        secretKey: nacl.util.encodeBase64(k.secretKey),
    },
    NoCrypto: {
        publicKey: "a",
        secretKey: "b",
    },
  }
  Object.keys(providers).map((n)=>{
    const p = providers[n];
    const key = keys[n];
    describe('#'+n, function () {
      it('should create new keys', function () {
        const c = new p()
        assert.notEqual(c.keys.publicKey.length, 0)
        assert.notEqual(c.keys.secretKey.length, 0)
      });
      it('should use given keys', function () {
        const c = new p(key)
        assert.notEqual(c.keys.publicKey.length, 0)
        assert.notEqual(c.keys.secretKey.length, 0)
        assert.deepEqual(c.keys.publicKey, key.publicKey)
        assert.deepEqual(c.keys.secretKey, key.secretKey)
      });
      it('should encrypt', function () {
        const c = new p()
        const data = "hello"
        const nonce = c.newNonce()
        const remotePubKey = c.publicKey()
        const encrypted = c.encrypt(data, nonce, remotePubKey)
        const decrypted = c.decrypt(encrypted, nonce, remotePubKey)
        assert.equal(data,decrypted)
      });
    });
  })
});
describe('Nacl', function () {
  describe('#new', function () {
    it('should generate binary64 encoded keys', function () {
      const c = new Nacl()
      assert.notEqual(c.keys.publicKey.length, 0)
      assert.notEqual(c.keys.secretKey.length, 0)
    });
    it('should set binary64 encoded keys', function () {
      const k = nacl.box.keyPair();
      const key = {
          publicKey: nacl.util.encodeBase64(k.publicKey),
          secretKey: nacl.util.encodeBase64(k.secretKey),
      }
      const c = new Nacl(key)
      assert.notEqual(c.keys.publicKey.length, 0)
      assert.notEqual(c.keys.secretKey.length, 0)
      assert.deepEqual(c.keys.publicKey, key.publicKey)
      assert.deepEqual(c.keys.secretKey, key.secretKey)
    });
    it('should set uint8 keys', function () {
      const k = nacl.box.keyPair();
      const key = {
          publicKey: nacl.util.encodeBase64(k.publicKey),
          secretKey: nacl.util.encodeBase64(k.secretKey),
      }
      const c = new Nacl(k)
      assert.notEqual(c.uint8keys.publicKey.length, 0)
      assert.notEqual(c.uint8keys.secretKey.length, 0)
      assert.deepEqual(c.uint8keys.publicKey, k.publicKey)
      assert.deepEqual(c.uint8keys.secretKey, k.secretKey)
      assert.deepEqual(c.keys.publicKey, key.publicKey)
      assert.deepEqual(c.keys.secretKey, key.secretKey)
    });
  });
});
