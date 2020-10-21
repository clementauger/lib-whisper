// const jsSHA = require("jssha");
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');
// const util = require('util');
var shaker = require("./saltshaker/saltshaker");

class SaltShaker {
  constructor(){
    this.nonces = [];
  }

  async create(){
    const k = shaker.create();
    return {
      publicKey: k.publickey,
      privateKey: k.privatekey,
    }
  }

  async newNonce(){
    if (this.nonces.length > 500) {
      this.nonces.slice(500, this.nonces.length-500)
    }
    while(true) {
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      const bnonce = nacl.util.encodeBase64(nonce)
      if (!this.nonces.includes(bnonce)) {
        this.nonces.push(bnonce)
        return bnonce;
      }
    }
    return ;
  }

  async encrypt(data, remotePubKey, yourPrivKey) {
    const nonce = await this.newNonce();
    var res = shaker.encrypt(data, nonce, remotePubKey, yourPrivKey);
    return nonce+":"+res;
  }

  async decrypt(data, remotePubKey, yourPrivKey) {
    const [nonce, crypted] = data.split(":")
    return shaker.decrypt(crypted, nonce, remotePubKey, yourPrivKey);
  }

  async sign(data, yourPrivKey) {
    return shaker.sign(data, yourPrivKey);
  }

  async verify(data, remotePubKey) {
    return shaker.verify(data, remotePubKey);
  }
}

module.exports = { SaltShaker: new SaltShaker() }
