const { Nacl } = require("./nacl")
const { NoCrypto } = require("./nocrypto")
const { SaltShaker } = require("./saltshaker")
const { Pgp } = require("./pgp")

const openpgp = require('openpgp');
var nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

var assert = require('assert');
describe('Crypto', async function () {
  const k = nacl.box.keyPair();
  // const k2 = nacl.sign.keyPair();
  const k2 = nacl.box.keyPair();
  const k3 =  await openpgp.generateKey({
    userIds: [{ name: 'Jon Smith', email: 'jon@example.com' }],
    curve: 'ed25519',
    passphrase: ''
  });
  const tests = {
    "Nacl":{
      provider: Nacl,
      original: k,
      keys: {
          publicKey: nacl.util.encodeBase64(k.publicKey),
          privateKey: nacl.util.encodeBase64(k.secretKey),
      }
    },

    "NoCrypto":{
      provider: NoCrypto,
      keys: {
          publicKey: "a",
          privateKey: "b",
      }
    },

    "SaltShaker":{
      provider: SaltShaker,
      original: k2,
      keys: {
          publicKey: nacl.util.encodeBase64(k2.publicKey),
          privateKey: nacl.util.encodeBase64(k2.secretKey),
      },
    },

    "Pgp":{
      provider: Pgp,
      original: k3,
      keys: {
          publicKey: k3.publicKeyArmored,
          privateKey: k3.privateKeyArmored,
      }
    },

  }
  Object.keys(tests).map((name)=>{
    const provider = tests[name].provider;
    // const original = tests[n].original;
    const keys = tests[name].keys;
    describe('#'+name, function () {
      it('should create new keys', async function () {
        const c = new provider()
        await c.init()
        assert.notEqual(c.keys.publicKey.length, 0)
        assert.notEqual(c.keys.privateKey.length, 0)
      });
      it('should use given keys', async function () {
        const c = new provider()
        await c.init(keys)
        assert.notEqual(c.keys.publicKey.length, 0)
        assert.notEqual(c.keys.privateKey.length, 0)
        assert.deepEqual(c.keys.publicKey, keys.publicKey)
        assert.deepEqual(c.keys.privateKey, keys.privateKey)
      });
      it('should encrypt', async function () {
        const c = new provider()
        await c.init()
        const d = new provider()
        await d.init()
        const data = "hello"
        const remotePubKey = c.publicKey()
        const encrypted = await c.encrypt(data, d.publicKey())
        const decrypted = await d.decrypt(encrypted, c.publicKey())
        assert.equal(data, decrypted)
      });
      it('should sign', async function () {
        const c = new provider()
        await c.init()
        const d = new provider()
        await d.init()
        const data = "hello"
        const remotePubKey = c.publicKey()
        const signed = await c.sign(data)
        const unsigned = await d.verify(signed, c.publicKey())
        assert.equal(data, unsigned)
      });
    });
  })
});
describe('Nacl', function () {
  describe('#new', function () {
    it('should generate binary64 encoded keys', async function () {
      const c = new Nacl()
      await c.init()
      assert.notEqual(c.keys.publicKey.length, 0)
      assert.notEqual(c.keys.privateKey.length, 0)
    });
    it('should set binary64 encoded keys', async function () {
      const k = nacl.box.keyPair();
      const key = {
          publicKey: nacl.util.encodeBase64(k.publicKey),
          privateKey: nacl.util.encodeBase64(k.secretKey),
      }
      const c = new Nacl()
      await c.init(key)
      assert.notEqual(c.keys.publicKey.length, 0)
      assert.notEqual(c.keys.privateKey.length, 0)
      assert.deepEqual(c.keys.publicKey, key.publicKey)
      assert.deepEqual(c.keys.privateKey, key.privateKey)
    });
    // it('should set uint8 keys', function () {
    //   const k = nacl.box.keyPair();
    //   const key = {
    //       publicKey: nacl.util.encodeBase64(k.publicKey),
    //       privateKey: nacl.util.encodeBase64(k.secretKey),
    //   }
    //   const c = new Nacl(k)
    //   assert.deepEqual(c.uint8keys.publicKey, k.publicKey)
    //   assert.deepEqual(c.uint8keys.secretKey, k.secretKey)
    //   assert.deepEqual(c.keys.publicKey, key.publicKey)
    //   assert.deepEqual(c.keys.privateKey, key.privateKey)
    // });
  });
});
