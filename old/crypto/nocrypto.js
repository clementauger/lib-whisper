
var uid = 0;

class NoCrypto {
  // constructor(){
    // this.nonces = [];
    // this.keys = {
    //   publicKey: "",
    //   privateKey: "",
    // }
  // }

  async create(){
    const id = uid++;
    return {
      publicKey: "publicKey#"+id,
      privateKey: "privateKey#"+id,
    }
  }
  // async init(keys){
  //   if (keys) {
  //     return this.set(keys)
  //   }
  //   return this.set(await this.create())
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
  //     const id = uid++;
  //     const nonce = "nonce#"+id;
  //     if (!this.nonces.includes(nonce)) {
  //       this.nonces.push(nonce)
  //       return nonce;
  //     }
  //   }
  //   return ;
  // }

  // async hash(roomID, roomPwd, d, mePubKeyB64){
  //   var args = Array.from(arguments).map((a)=>{
  //     if (a.toISOString) {
  //       return a.toISOString()
  //     }
  //     return a
  //   });
  //   return JSON.stringify(args)
  // }

  async encrypt(data, remotePubKeyB64, yourPrivKey) {
    const p = {
      data, remotePubKeyB64
    }
    return JSON.stringify(p)
  }

  async decrypt(datab64, remotePubKeyB64, yourPrivKey) {
    const p = JSON.parse(datab64);
    return p.data;
  }

  async sign(data, yourPrivKey) {
    return "signed"+data;
  }

  async verify(data, remotePubKey) {
    var j = "signed";
    if (data.startsWith(j)) {
      return data.slice(j.length);
    }
    return false;
  }

  // publicKey() {
  //   return this.keys.publicKey;
  // }
}

module.exports = { NoCrypto: new NoCrypto() }
