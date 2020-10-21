const { Nacl } = require("./nacl")
const { NoCrypto } = require("./nocrypto")
const { SaltShaker } = require("./saltshaker")
const { Pgp } = require("./pgp")

var assert = require('assert');
describe('Crypto', async function () {
  const tests = {
    "Nacl":Nacl,
    "NoCrypto":NoCrypto,
    "SaltShaker":SaltShaker,
    "Pgp":Pgp,
  }
  Object.keys(tests).map((name)=>{
    const provider = tests[name];
    const keys = tests[name].keys;
    describe('#'+name, function () {
      it('should create new keys', async function () {
        const keys = await provider.create()
        if(!keys.publicKey){
          console.log(name)
        }
        assert.notEqual(keys.publicKey.length, 0)
        assert.notEqual(keys.privateKey.length, 0)
      });
      it('should encrypt', async function () {
        const bobKeys = await provider.create()
        const aliceKeys = await provider.create()
        const data = "hello"
        const encrypted = await provider.encrypt(data, bobKeys.publicKey, aliceKeys.privateKey)
        const decrypted = await provider.decrypt(encrypted, aliceKeys.publicKey, bobKeys.privateKey)
        assert.equal(data, decrypted)
      });
      it('should sign', async function () {
        const aliceKeys = await provider.create()
        const data = "hello"
        const signed = await provider.sign(data, aliceKeys.privateKey)
        const unsigned = await provider.verify(signed, aliceKeys.publicKey)
        assert.equal(data, unsigned)
      });
    });
  })
});
