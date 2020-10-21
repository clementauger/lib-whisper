
var uid = 0;

class NoCrypto {

  async create(){
    const id = uid++;
    return {
      publicKey: "publicKey#"+id,
      privateKey: "privateKey#"+id,
    }
  }

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

}

module.exports = { NoCrypto: new NoCrypto() }
