const openpgp = require('openpgp');
// const jsSHA = require("jssha");
// const nacl = require('tweetnacl');
// nacl.util = require('tweetnacl-util');
// const util = require('util');
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
  // constructor(){
  //   this.nonces = [];
  //   this.keys = {
  //     publicKey: "",
  //     privateKey: "",
  //   }
  // }

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
  // async init(keys){
  //   if (keys) {
  //     return this.set(keys)
  //   }
  //   this.set(await this.create())
  // }
  //
  // set(k) {
  //   this.keys.publicKey = k.publicKey
  //   this.keys.privateKey = k.privateKey
  // }
  //
  // get() {
  //   return {
  //     publicKey: this.keys.publicKey,
  //     privateKey: this.keys.privateKey,
  //   }
  // }

  // async newNonce(){
  //   if (this.nonces.length > 500) {
  //     this.nonces.slice(500, this.nonces.length-500)
  //   }
  //   while(true) {
  //     const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  //     const bnonce = nacl.util.encodeBase64(nonce)
  //     if (!this.nonces.includes(bnonce)) {
  //       this.nonces.push(bnonce)
  //       return bnonce;
  //     }
  //   }
  //   return ;
  // }

  // async hash(roomID, roomPwd, d, mePubKeyB64){
  //     var args = Array.from(arguments).map((a)=>{
  //       if (a.toISOString) {
  //         return a.toISOString()
  //       }
  //       return a
  //     });
  //     const encoder = new util.TextEncoder();
  //     const shaObj = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
  //     args.map((a)=>{
  //       shaObj.update(a);
  //     })
  //     const hash = shaObj.getHash("UINT8ARRAY");
  //     return nacl.util.encodeBase64(hash);
  // }

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

  // publicKey() {
  //   return this.keys.publicKey;
  // }
}

module.exports = { Pgp: new Pgp() }
