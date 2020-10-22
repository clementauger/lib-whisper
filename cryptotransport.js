const { SumHash, Nonce } = require("./crypto.js")
const EventEmitter = require('events');
const { NoCrypto } = require("./crypto/nocrypto")
// const { Nacl } = require("./crypto/nacl")
// const { Pgp } = require("./crypto/pgp")
// const { SaltShaker } = require("./crypto/saltshaker")

class CryptoTransport {

  constructor({
    transport=null,
    crypter=NoCrypto,
    keys={publicKey: null, privateKey: null},
    shared={publicKey: null, privateKey: null},
  }) {
    if (keys.publicKey===null || keys.privateKey===null){
      throw "keys must be provided"
    }
    if (shared.publicKey===null || shared.privateKey===null){
      throw "shared keys must be provided"
    }
    this._events = new EventEmitter();
    this._crypter = crypter;
    this._keys = keys;
    this._sharedKeys = []
    this._transport = transport;
    this._onTransportMessage = this._onTransportMessage.bind(this)
    this._onTransportError = this._onTransportError.bind(this)
    this._onTransportConnect = this._onTransportConnect.bind(this)
    this._onTransportDisconnect = this._onTransportDisconnect.bind(this)
    this.addSharedKey(this._keys.publicKey, shared)
  }

  async _onTransportConnect () {
    this.trigger("connect");
  }
  async _onTransportDisconnect () {
    this.trigger("disconnect");
  }

  async connect() {
    this._transport.on("message", this._onTransportMessage)
    this._transport.on("error", this._onTransportError)
    this._transport.on("connect", this._onTransportConnect)
    this._transport.on("disconnect", this._onTransportDisconnect)
    return await this._transport.connect();
  }

  async close(transport) {
    this._sharedKeys = this._sharedKeys.filter( notFrom(this.publicKey) )
    this._transport.off("message", this._onTransportMessage)
    this._transport.off("error", this._onTransportError)
    this._transport.off("connect", this._onTransportConnect)
    this._transport.off("disconnect", this._onTransportDisconnect)
    return await this._transport.close();
  }

  // publicKey returns underlying public key.
  publicKey () {
    return this._keys.publicKey;
  }

  // privateKey returns underlying private key.
  privateKey () {
    return this._keys.privateKey;
  }

  addSharedKey(from, key){
    this._sharedKeys.push({from: from, key: key, since: new Date()});
  }
  rmSharedKey(from){
    this._sharedKeys = this._sharedKeys.filter( notFrom(from) )
  }

  async decode(from, to, data){
    var privkey = null;
		if (to === this.publicKey()){
      privkey = this.privateKey()
		} else {
      var foundkey = this._sharedKeys.filter( isSharedPubkey(to) ).pop()
      if (!foundkey) {
        return null;
      }
      privkey = foundkey.key.privateKey
		}
    return await this._crypter.decrypt(data, from, privkey).catch(console.error)
  }

  async encode(msg, toPubKey, fromPubKey){
    var privkey = null;
    if (fromPubKey === this.publicKey()){
      privkey = this.privateKey()
    } else {
      var foundkey = this._sharedKeys.filter( isPubKey(toPubKey) ).pop()
      if (!foundkey) {
        return null;
      }
      privkey = foundkey.key.privateKey
    }
    const smsg= JSON.stringify(msg);
    const data = await this._crypter.encrypt(smsg, toPubKey, privkey);
    const sign = await this._crypter.sign(await SumHash(data), this.privateKey());
    return { "data": data, "from": fromPubKey, "to": toPubKey, "sign":sign };
  }

  async _onTransportMessage (msg) {
    if (typeof msg !=="object" || !(msg instanceof Object)) {
      console.error("got non object from transport", msg)
      return
    }
    if(!msg.sign) {
      return
    }

    const verify = await this._crypter.verify(msg.sign, msg.from)
    if (!verify){
      return
    }
    if (msg.type && msg.type=="announce") {
      this.trigger("message", msg);
      return
    }
    const scleardata = await this.decode(msg.from, msg.to, msg.data);
    if (!scleardata){
      return
    }
		const cleardata = JSON.parse(scleardata);
    if(!cleardata.type) {
      console.error(this._keys.publicKey, "invalid packet: missing type qualifier")
      return
    }
    this.trigger("message", msg, cleardata);
  }


	// send a private message.
	async send(msg, b64ToPubKey) {
    if (!this._transport) {
      return "not connected"
    }
    if(!b64ToPubKey){
      msg.sign = await this._crypter.sign(msg.data, this.privateKey())
      return this._transport.send(msg);
    }
    const packet = await this.encode(msg, b64ToPubKey, this.publicKey())
		return this._transport.send(packet);
	}

	// broadcast, encrypt and authenticate a message using a sharedKey.
	async broadcast (msg) {
    const oldest = this._sharedKeys.sort(sortBySince).slice(0,1).shift();
    if (!oldest) {
      console.error(this.me.handle, "could not find a peer to send message")
      return
    }
    if (!oldest.key) {
      console.error(this.me.handle, "could not get peer shared keys to send message")
      return
    }
    const packet = await this.encode(msg, oldest.key.publicKey, this.publicKey())
		return this._transport.send(packet);
	}

  async _onTransportError () {
    var args = Array.from(arguments);
    args.unshift("error")
    return this.trigger.apply(this, args);
  }

  // rmDHTAnnounce removes a dht announce from underlying transport
  rmDHTAnnounce (a) {
    if (this._transport && this._transport.rmDHTAnnounce) {
      return this._transport.rmDHTAnnounce(a)
    }
  }

  // addDHTAnnounce adds a dht announce to underlying transport
  addDHTAnnounce (a) {
    if (this._transport && this._transport.addDHTAnnounce) {
      return this._transport.rmDHTAnnounce(a)
    }
  }

  // on register an event listener.
  on (ev, handle, opts) {
     return this._events.on(ev, handle, opts);
  }

  // once register a listener that triggers once.
  once (ev, handle, opts) {
   return this._events.once(ev, handle, opts);
  }

  // off removes an event listener from an event.
  off (ev, handle, opts) {
    if (!handle) {
      return this._events.removeAllListeners(ev);
    }
   return this._events.off(ev, handle, opts);
  }

  // trigger an event with its argument.
  trigger () {
    var args = Array.from(arguments);
    return this._events.emit.apply(this._events, args);
  }
}
function notFrom(pubKey){
  return (p) => {
    return p.from!==pubKey;
  }
}
function isFrom(pubKey){
  return (p) => {
    return p.from===pubKey;
  }
}
function isSharedPubkey(publicKey){
  return (k) => {
    return k.key && k.key.publicKey===publicKey
  }
}
function sortBySince(a, b) {
    const aSince = Date.parse(a.since)
    const bSince = Date.parse(a.since)
    if (aSince < bSince) {
      return -1;
    } else if (aSince > bSince) {
      return 1;
    }
    return 0;
}

module.exports = { CryptoTransport }
