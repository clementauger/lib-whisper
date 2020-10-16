// const jsSHA = require("jssha");
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');
// const util = require('util');
var shaker = require("./saltshaker/saltshaker");

class SaltShaker {
  constructor(){
    this.nonces = [];
    // this.keys = {
    //   publicKey: "",
    //   privateKey: "",
    // };
  }

  async create(){
    const k = shaker.create();
    return {
      publicKey: k.publickey,
      privateKey: k.privatekey,
    }
  }
  // async init(keys){
  //   if (keys && (
  //     (keys.publicKey!==""&&keys.privateKey!=="") || (keys.publickey!==""&&keys.privatekey!=="")
  //   )) {
  //     return this.set(keys)
  //   }
  //   this.set(await this.create())
  // }
  //
  // set(k) {
  //   if(k.publickey&&k.privatekey) {
  //     this.keys = {
  //     publicKey:k.publickey,
  //     privateKey:k.privatekey,
  //   }
  //   }else{
  //     this.keys = k
  //   }
  // }
  //
  // get() {
  //   return {
  //     publicKey: this.keys.publicKey,
  //     privateKey: this.keys.privateKey,
  //   }
  // }

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

  // async hash(roomID, roomPwd, d, mePubKeyB64){
  //   var args = Array.from(arguments).map((a)=>{
  //     if (a.toISOString) {
  //       return a.toISOString()
  //     }
  //     return a
  //   });
  //   const encoder = new util.TextEncoder();
  //   const shaObj = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
  //   args.map((a)=>{
  //     shaObj.update(a);
  //   })
  //   const hash = shaObj.getHash("UINT8ARRAY");
  //   return nacl.util.encodeBase64(hash);
  // }

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

  // publicKey() {
  //   return this.keys.publicKey;
  // }
}

module.exports = { SaltShaker: new SaltShaker() }
