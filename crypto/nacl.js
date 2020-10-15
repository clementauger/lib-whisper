// const jsSHA = require("jssha");
// const nacl = require('tweetnacl');
// nacl.util = require('tweetnacl-util');
// const util = require('util');
const { SaltShaker } = require("./saltshaker")

// class Nacl {
//   constructor(keys){
//     this.nonces = [];
//     this.keys = {
//       publicKey: "",
//       privateKey: "",
//     };
//     this.uint8keys = {
//       publicKey: [],
//       secretKey: [],
//     }
//     if (keys && keys.publicKey&&(keys.privateKey||keys.secretKey)) {
//       this.set(keys)
//     }else {
//       this.init()
//     }
//   }
//
//   init(){
//     this.uint8keys = nacl.box.keyPair();
//     this.keys.publicKey = nacl.util.encodeBase64(this.uint8keys.publicKey)
//     this.keys.privateKey = nacl.util.encodeBase64(this.uint8keys.secretKey)
//   }
//
//   set(k) {
//     try {
//       this.uint8keys.publicKey = nacl.util.decodeBase64(k.publicKey)
//       this.uint8keys.secretKey = nacl.util.decodeBase64(k.privateKey)
//       this.keys = k
//     }catch(e) {
//       this.keys.publicKey = nacl.util.encodeBase64(k.publicKey)
//       this.keys.privateKey = nacl.util.encodeBase64(k.secretKey)
//       this.uint8keys = k
//     }
//   }
//
//   get() {
//     return {
//       publicKey: this.keys.publicKey,
//       privateKey: this.keys.privateKey,
//     }
//   }
//
//   newNonce(){
//     if (this.nonces.length > 500) {
//       this.nonces.slice(500, this.nonces.length-500)
//     }
//     while(true) {
//       const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
//       const bnonce = nacl.util.encodeBase64(nonce)
//       if (!this.nonces.includes(bnonce)) {
//         this.nonces.push(bnonce)
//         return bnonce;
//       }
//     }
//     return ;
//   }
//
//   hash(roomID, roomPwd, d, mePubKeyB64){
//     var args = Array.from(arguments);
//     const encoder = new util.TextEncoder();
//     const shaObj = new jsSHA("SHA-512", "TEXT", { encoding: "UTF8" });
//     args.map((a)=>{
//       shaObj.update(a);
//     })
//     const hash = shaObj.getHash("UINT8ARRAY");
//     return nacl.util.encodeBase64(hash);
//   }
//
//   encrypt(data, nonceb64, remotePubKeyB64) {
//     const bdata = nacl.util.decodeUTF8(data);
//     const nonce = nacl.util.decodeBase64(nonceb64);
//     const remotePubKey = nacl.util.decodeBase64(remotePubKeyB64);
//     const crypted = nacl.box(bdata, nonce, remotePubKey, this.uint8keys.secretKey.slice(0,32))
//     if (!crypted) {
//       return ""
//     }
//     return nacl.util.encodeBase64(crypted);
//   }
//
//   decrypt(datab64, nonceb64, remotePubKeyB64) {
//     const data = nacl.util.decodeBase64(datab64);
//     const nonce = nacl.util.decodeBase64(nonceb64);
//     const remotePubKey = nacl.util.decodeBase64(remotePubKeyB64);
//     const msg = nacl.box.open(data, nonce, remotePubKey, this.uint8keys.secretKey.slice(0,32));
//     if (!msg) {
//       return ""
//     }
//     return nacl.util.encodeUTF8(msg);
//   }
//
//   publicKey() {
//     return this.keys.publicKey;
//   }
// }

const Nacl = SaltShaker;

module.exports = { Nacl }
