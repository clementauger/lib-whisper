
var uid = 0;

class NoCrypto {
  constructor(keys){
    this.nonces = [];
    this.keys = {
      publicKey: "",
      secretKey: "",
    }
    if (keys) {
      this.set(keys)
    }else {
      this.init()
    }
  }

  init(){
    const id = uid++;
    this.keys = {
      publicKey: "publicKey#"+id,
      secretKey: "secretKey#"+id,
    }
  }

  set(k) {
    this.keys.publicKey = k.publicKey
    this.keys.secretKey = k.secretKey
  }

  get() {
    return {
      publicKey: this.keys.publicKey,
      secretKey: this.keys.secretKey,
    }
  }

  newNonce(){
    if (this.nonces.length > 500) {
      this.nonces.slice(500, this.nonces.length-500)
    }
    while(true) {
      const id = uid++;
      const nonce = "nonce#"+id;
      if (!this.nonces.includes(nonce)) {
        this.nonces.push(nonce)
        return nonce;
      }
    }
    return ;
  }

  hash(roomID, roomPwd, d, mePubKeyB64){
    const p = {
      roomID, roomPwd, d, mePubKeyB64
    }
    return JSON.stringify(p)
  }

  encrypt(data, nonceb64, remotePubKeyB64) {
    const p = {
      data, nonceb64, remotePubKeyB64
    }
    return JSON.stringify(p)
  }

  decrypt(datab64, nonceb64, remotePubKeyB64) {
    const p = JSON.parse(datab64);
    return p.data;
  }

  publicKey() {
    return this.keys.publicKey;
  }
}

module.exports = { NoCrypto }
