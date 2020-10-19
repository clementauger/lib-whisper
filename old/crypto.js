const { NoCrypto } = require("./crypto/nocrypto")
const { Nacl } = require("./crypto/nacl")
const { Pgp } = require("./crypto/pgp")
const { SaltShaker } = require("./crypto/saltshaker")

const jsSHA = require("jssha");
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');
const util = require('util');

var Crypters = {
  NoCrypto, Nacl, Pgp, SaltShaker
}

async function Nonce(){
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return nacl.util.encodeBase64(nonce);
}

async function SumHash(roomID, roomPwd, d, mePubKeyB64){
  var args = Array.from(arguments).map((a)=>{
    if (a.toISOString) {
      return a.toISOString()
    }
    return a
  });
  const encoder = new util.TextEncoder();
  const shaObj = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
  args.map((a)=>{
    shaObj.update(a);
  })
  const hash = shaObj.getHash("UINT8ARRAY");
  return nacl.util.encodeBase64(hash);
}

module.exports = { SumHash, Nonce, Crypters }
