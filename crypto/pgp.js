const openpgp = require('openpgp');
const { isBrowser } = require("browser-or-node");


openpgp.config.compression = openpgp.enums.compression.zlib;

if (isBrowser) {
  const path = window.PGPWORKER || 'openpgp.worker.js'
  openpgp.initWorker({ path });
  window.addEventListener("beforeunload", function (e) {
    openpgp.destroyWorker();
  });
}

class Pgp {

  async create(){
    const { privateKeyArmored, publicKeyArmored } = await openpgp.generateKey({
        userIds: [{ name: 'Jon Smith', email: 'jon@example.com' }],
        curve: 'ed25519',
        passphrase: ''
    });
    return {
      publicKey: publicKeyArmored,
      privateKey: privateKeyArmored,
    }
  }

  async encrypt(data, remotePubKey, yourPrivKey) {
    const { keys: [privateKey] } = await openpgp.key.readArmored(yourPrivKey);
    const { data: encrypted } = await openpgp.encrypt({
        message: openpgp.message.fromText(data),
        publicKeys: (await openpgp.key.readArmored(remotePubKey)).keys,
        privateKeys: [privateKey]
    });
    return encrypted
  }

  async decrypt(data, remotePubKey, yourPrivKey) {
    const { keys: [privateKey] } = await openpgp.key.readArmored(yourPrivKey);
    const { data: decrypted } = await openpgp.decrypt({
        message: await openpgp.message.readArmored(data),
        publicKeys: (await openpgp.key.readArmored(remotePubKey)).keys,
        privateKeys: [privateKey]
    });
    return decrypted
  }

  async sign(data, yourPrivKey) {
    const { keys: [privateKey] } = await openpgp.key.readArmored(yourPrivKey);
    const { data: cleartext } = await openpgp.sign({
        message: openpgp.cleartext.fromText(data),
        privateKeys: [privateKey]
    });
    return cleartext
  }

  async verify(data, remotePubKey) {
    const verified = await openpgp.verify({
        message: await openpgp.cleartext.readArmored(data),
        publicKeys: (await openpgp.key.readArmored(remotePubKey)).keys
    });
    const { valid } = verified.signatures[0];
    const { data: cleartext } = verified;
    if(!valid){
      return false
    }
    return cleartext
  }
}

module.exports = { Pgp: new Pgp() }
