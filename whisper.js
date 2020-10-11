const EventEmitter = require('events');

var MsgType = MsgType || {};
MsgType.Announce = "announce";
MsgType.Login = "login";
MsgType.LoginResponse = "login-res";
MsgType.Message = "message";

var EvType = EvType || {};
EvType.Error = "error";
EvType.Message = "message";
EvType.Accept = "accept";
EvType.PeerConnect = "peer.connect";
EvType.PeerAccept = "peer.accept";
EvType.PeerLeave = "peer.leave";
EvType.PeerRenewHandle = "renew.peerhandle";
EvType.RenewMyHandle = "renew.myhandle";
EvType.Negotiating = "negotiating";

var ChResults = ChResults || {};
ChResults.PeerNotFound = "peer-not-found";
ChResults.InProgress = "in-progress";
ChResults.InvalidHash = "invalid-hash";
ChResults.DuplicateHandle = "duplicate.handle";
ChResults.InvalidSealedAuth = "invalid.sealedauth";
ChResults.OK = "ok";

var WhisperOpts = {
  AnnounceTimeout: 60 * 5,
  FailedAnnounceTimeout: 60 * 2,
}

class Whisper {
  constructor (crypter, roomID, roomPwd, me) {
    this.events = new EventEmitter();
    this.msgDispatcher = new EventEmitter();

    this.roomID = roomID;
    this.roomPwd = roomPwd;


    // {handle, keys:{publicKey, secretKey}}
    this.me = {handle: me.handle};
    // {publicKey, handle}
    this.peers = [];

    this.transport = null;

    this.announceInterval = 100;
    this.announceHandle = null;
    // {publicKey, date, hash}
    this.announces = [];

    // {from: public key b64, key: {publicKey: b64, secret: b64}, since: Date}
    this.sharedKeys = [];

    // pubkey=>{token, since, result}
    this.tokens = {};
    // pubkey=>status
    this.peerStatus = {};

    if(!crypter) { crypter = Nacl }
    this.crypter = crypter;
    this.mycrypto = new crypter(this.me.keys);
    this.mesharedcrypto = new crypter();

    if (!this.me.handle) {
      this.me.handle = this.makeid(5)
    }
  }

  // on register an event listener.
  on (ev, handle, opts) {
     return this.events.on(ev, handle, opts);
  }

  // once register a listener that triggers once.
  once (ev, handle, opts) {
   return this.events.once(ev, handle, opts);
  }

  // off removes an event listener from an event.
  off (ev, handle, opts) {
    if (!handle) {
      return this.events.removeAllListeners(ev);
    }
   return this.events.off(ev, handle, opts);
  }

  // trigger an event with its argument.
  trigger () {
    var args = Array.from(arguments);
    return this.events.emit.apply(this.events, args);
  }

  // connect on given transport. It implements connects, send, on, off.
  // It triggers connect, error, disconnect, message
  connect (transport) {
    if (this.transport){
      this.close();
    }
    this.transport = transport;
    this.sharedKeys.push({from: this.mycrypto.publicKey(), key: this.mesharedcrypto.get(), since: new Date()});

    this.msgDispatcher.on(MsgType.Announce, this.onAnnounce.bind(this))
    this.msgDispatcher.on(MsgType.Login, this.onLogin.bind(this))
    this.msgDispatcher.on(MsgType.LoginResponse, this.onLoginResponse.bind(this))
    this.transport.on(EvType.Message, this.onTransportMessage.bind(this))
    this.transport.on(EvType.Error, this.onTransportError.bind(this))

    this.announce()
  }

  // close the underlying transport.
  // triggers diconnect event.
  close () {
    this.msgDispatcher.removeAllListeners(MsgType.Announce)
    this.msgDispatcher.removeAllListeners(MsgType.Login)
    this.msgDispatcher.removeAllListeners(MsgType.LoginResponse)
    if (this.transport) {
      this.transport.off(EvType.Message)
      this.transport.off(EvType.Error)
    }
    this.transport = null;
    this.sharedKeys = []
    this.peers = []
    clearTimeout(this.announceHandle)
  }

  // onTransportError handles transport error.
  onTransportError (err) {
    this.trigger(EvType.Error, err)
  }

  _debug(info) {
    this.trigger("debug", info)
  }

  // onTransportMessage decodes input message and triggers the related event handler.
  onTransportMessage (message) {
    var msg = {};
    if (typeof message ==="object" || message instanceof Object) {
      msg = message
    } else {
      try {
        msg = JSON.parse(message);
      } catch (e) {
        console.error("failed to json parse message ", e);
        return null;
      }
    }

    if (msg.type && msg.type===MsgType.Announce) {
      this._debug({handle: this.me.handle, type: "message", dir: "rcv", data: msg})
      this.onAnnounce(msg)
      return
    }

		var foundkey=null;
		if (msg.to === this.mycrypto.publicKey()){
			foundkey = this.mycrypto.get()
		} else {
      foundkey = this.sharedKeys.filter( this.isSharedPubkey(msg.to) ).pop()
      if (foundkey) {
        foundkey = foundkey.key
      }
		}
    if (!foundkey) {
      console.error("key not found for ", msg)
      return
    }

    var k = new this.crypter(foundkey)
    const scleardata = k.decrypt(msg.data, msg.nonce, msg.from)

		if (!scleardata) {
			console.error("foundkey ", foundkey)
			console.error("msg not decrypted ", msg)
			return
		}
    if (!this.announces[msg.from]){
      console.log(msg)
      console.log(scleardata)
      console.log(this.announces)
      return
    }
    this.announces[msg.from].lastSeen = new Date();
		var cleardata = JSON.parse(scleardata);

    if(!cleardata.type) {
      console.error("invalid packaet: missing type qualifier")
      return
    }
    this._debug({handle: this.me.handle, type: "message", dir: "rcv", data: cleardata})

    // console.log(this.me.handle, "rcv", msg.from, cleardata)
    var getListeners = this.msgDispatcher.listeners || this.msgDispatcher.getListeners;
    getListeners = getListeners.bind(this.msgDispatcher)
    if (getListeners(cleardata.type).length>0){
      this.msgDispatcher.emit(cleardata.type, cleardata, msg);
      return
    }
    this.trigger(cleardata.type, cleardata, msg);
  }

	// announce yourself.
	announce () {
    // console.log("announce")
    clearTimeout(this.announceHandle)
    const d = new Date();
    const bPub = this.mycrypto.publicKey()
    const h = this.mycrypto.hash(this.roomID, this.roomPwd, d.toISOString(), bPub)
    const msg = {
      "type": MsgType.Announce,
      "publicKey": bPub,
      "date": d,
      "hash": h,
      //todo: add signature
    }
    this.transport.send(msg)
    this.announceHandle = setTimeout(this.announce.bind(this), this.announceInterval)
    this.peers = this.peers.filter( this.notPubKey(bPub) ).filter( (p) => {
      const from = p.publicKey;
      if(from===bPub){
        return true;
      }
      const announce = this.announces[from];
      if (!announce){
        return false;
      }
      if (!this.isBefore(announce.lastSeen, WhisperOpts.AnnounceTimeout)) {
        return true;
      }
      delete(this.announces[from])
      delete(this.peerStatus[from])
      this.trigger(EvType.PeerLeave, p)
      return false;
    })
	}
	// onAnnounce handles peers announces.
	onAnnounce (msg) {
    const bPub = this.mycrypto.publicKey()
    const from = msg.publicKey
    if (from===bPub) {
      return;
    }
    if (this.isBefore(msg.date, WhisperOpts.AnnounceTimeout)) {
      return
    }
    const valid = msg.hash===this.mycrypto.hash(this.roomID, this.roomPwd, msg.date, from)
    if (!valid){
      return
    }
    const wasValid = !!this.announces[from];
    this.announces[from] = {
      publicKey: msg.publicKey,
      hash: msg.hash,
      date: msg.date,
      lastSeen: new Date(),
    };
    if (valid && !wasValid) {
      this.login(from);
    }
	}

  newToken(publicKey, typ) {
    this.trigger(EvType.Negotiating, this.cntNegotiations())
    if (!this.tokens[publicKey]) {
      this.tokens[publicKey] = {}
    }
    if (!this.tokens[publicKey][typ]) {
      this.tokens[publicKey][typ] = {}
    }
    const t = this.makeid(16);
    this.tokens[publicKey][typ][t] = {
      token: t,
      since: new Date(),
      type: typ,
    }
    return this.tokens[publicKey][typ][t];
  }
  validateToken(publicKey, typ, token, result) {
    if (!this.tokens[publicKey]) {
      return false
    }
    if (!this.tokens[publicKey][typ]) {
      return false
    }
    if (!this.tokens[publicKey][typ][token]) {
      return false
    }
    const curNego = this.tokens[publicKey][typ][token];
    delete(this.tokens[publicKey][typ][token])
    if (this.tokens[publicKey][typ].length<1){
      delete(this.tokens[publicKey][typ])
    }
    if (this.tokens[publicKey].length<1){
      delete(this.tokens[publicKey])
    }
    if( curNego.token!==token){
      return false
    }
    if (this.isBefore(curNego.since, WhisperOpts.AnnounceTimeout)) {
      console.error("invalid token: lifetime exceeded");
      return false
    }
    return true
  }
  cntNegotiations(typs) {
    var cnt = 0;
    Object.keys(this.tokens).map((pbk)=>{
      if(!typs) { typs = Object.keys(this.tokens[pbk]) }
      typs.map( (typ) => {
        cnt += Object.keys(this.tokens[pbk][typ]).length
      })
    });
    return cnt
  }

	// login handles peers announces.
	login (withPublicKey) {
    const bPub = this.mycrypto.publicKey();
    const tok = this.newToken(withPublicKey, MsgType.Login)
    const msg = {
      "type": MsgType.Login,
      "handle": this.me.handle,
      "hash": this.mycrypto.hash(this.roomID, this.roomPwd, tok.since.toISOString(), bPub),
      "token":tok,
    }
    this.trigger(EvType.Negotiating, this.cntNegotiations())
    this.send(msg, withPublicKey)
	}
	// login handles peers announces.
	onLogin (cleardata, data) {
    // console.log("onLogin", cleardata)
    const a = cleardata.hash===this.mycrypto.hash(this.roomID, this.roomPwd, cleardata.token.since, data.from)
    if (!a) {
      this.issueLoginResponse(data.from, cleardata.token.token, ChResults.InvalidHash)
      return
    }

    var isNew = false;
    var peer = this.peers.filter( this.isPubKey(data.from) ).shift()
    if (!peer){
      isNew = true;
      peer = {
        handle: cleardata.handle,
        publicKey: data.from,
      }
    }

    const bPub = this.mycrypto.publicKey();
    const conflictPeerHandle = this.peers.filter( this.notPubKey(peer.publicKey) )
      .filter( this.isHandle(peer.handle) ).shift();

    if (conflictPeerHandle) {
      this.issueInvalidPeerHandle(peer, cleardata.token.token, peer.handle)
      return
    }

    if (isNew) {
      this.peers.push(peer);
    }else if (peer.handle != cleardata.handle) {
      const oldHandle = peer.handle;
      peer.handle = cleardata.handle;
      this.trigger(EvType.PeerRenewHandle, peer, oldHandle)
    }
    this.peers.sort(this.sortByHandle)

    this.issueLoginResponse(
      peer.publicKey,
      cleardata.token.token,
      ChResults.OK,
      {shared: this.mesharedcrypto.get()},
    );
	}

  // issueLoginResponse.
  issueLoginResponse(peerPublicKey, token, result, opts) {
    this.setPeerStatus(peerPublicKey, result)
    const bPub = this.mycrypto.publicKey();
    var data = opts || {}
    data.type = MsgType.LoginResponse
    data.token = token
    data.result = result
    this.send(data, peerPublicKey);
  }

  issueInvalidPeerHandle(peer, token, oldHandle) {
    const bPub = this.mycrypto.publicKey();
    if (peer.publicKey==bPub) {
      this.renewHandle()
      return
    }
    this.issueLoginResponse(
      peer.publicKey,
      token,
      ChResults.DuplicateHandle,
      {handle: oldHandle}
    );
  }

	// onLoginResponse handles peers announces.
	onLoginResponse (cleardata, data) {
    // console.log("onLoginResponse", cleardata)
    const nego = this.validateToken(data.from, MsgType.Login, cleardata.token)
    if (!nego) {
      console.log("onLoginResponse: invalid token", cleardata.token)
      return
    }
    this.trigger(EvType.Negotiating, this.cntNegotiations())

    const remote = this.peers.filter( this.isPubKey(data.from) ).shift();
    if (!remote){
      console.log("onLoginResponse: remote peer not found", data.from)
      return
    }

    if (cleardata.result===ChResults.OK){
      this.sharedKeys = this.sharedKeys.filter( this.notFrom(remote.publicKey) )
      this.sharedKeys.push({from: remote.publicKey, key: cleardata.shared, since: new Date()});
      this.setPeerStatus(remote.publicKey, ChResults.OK)
      this.trigger(EvType.PeerAccept, JSON.parse(JSON.stringify(remote)))

    } else{
      this.setPeerStatus(remote.publicKey, cleardata.result)
    }

    const acceptedPeers = this.peers.filter( this.iAccepted.bind(this) );
    if (acceptedPeers.length<1) {
      return
    }
    const majority = acceptedPeers.length/2;

    var invalidHash = this.cntPeerStatus(ChResults.InvalidHash);
    var invalidSealedAuth = this.cntPeerStatus(ChResults.InvalidSealedAuth);
    var handleKo = this.cntPeerStatus(ChResults.DuplicateHandle);
    var totalOk = this.cntPeerStatus(ChResults.OK);
    const totalKo = invalidHash + invalidSealedAuth + handleKo;

    if (handleKo>=majority || invalidSealedAuth>=majority) {
      this.renewHandle()
      return
    }else if (totalKo>=majority) {
      this.trigger(EvType.Error, "You were not accepted to the room");
      return
    }
    this.trigger(EvType.Accept);
	}

	// send, encrypt and authenticate a message usiing our keys to given public key.
	send(msg, b64ToPubKey) {
    if (this.transport){
      this._debug({handle: this.me.handle, type: "message", dir: "snd", data: {to:b64ToPubKey,data:msg}})
  		const nonce = this.mycrypto.newNonce();
  		const data = this.mycrypto.encrypt(JSON.stringify(msg), nonce, b64ToPubKey);
  		const bPub = this.mycrypto.publicKey();
  		const err = this.transport.send({ "data": data, "nonce": nonce, "from": bPub, "to": b64ToPubKey });
      if (err){
        console.error(err)
      }
    }
	}

	// broadcast, encrypt and authenticate a message using given sharedKey.
	broadcast (msg) {
    // console.log("brd", this.mycrypto.publicKey(), msg)
    const oldest = this.peers.filter(this.iAccepted).sort(this.sortBySince).pop();
    if (!oldest) {
      console.error("could not find a peer to send message")
      return
    }
    const key = this.sharedKeys.filter( this.withKey ).filter( this.isFrom(oldest.publicKey) ).pop();
    if (!key) {
      console.error("could not find peer shared keys to send message")
      return
    }
    if (!key.key) {
      console.error("could not get peer shared keys to send message")
      return
    }
		const bPub = this.mycrypto.publicKey();
		var crypto = new this.crypter(key.key);
		const nonce = crypto.newNonce();
		const data = this.mycrypto.encrypt(JSON.stringify(msg), nonce, crypto.publicKey());
    this._debug({handle: this.me.handle, type: "message", dir: "snd", data: {to:key.key.publicKey,data:data}})
		this.transport.send({ "data": data, "nonce": nonce, "from": bPub, "to": key.key.publicKey });
	}

	// broadcastDirect send a message to each accepted peer.
	broadcastDirect (msg) {
    // console.log("brdd", msg)
    var that = this;
    this.peers.filter(this.iAccepted).map( (p)=>{
      that.send(msg, p.publicKey)
    })
	}

  isPeerStatus(publicKey) {
    return this.peerStatus[publicKey] && this.peerStatus[publicKey]===ChResults.OK;
  }
  // setPeerStatus for a remote.
  setPeerStatus(publicKey, status) {
    if (status!==ChResults.OK && this.peerStatus[publicKey]===ChResults.OK) {
      const peer = this.peers.filter( this.isPubKey(peerPublicKey) ).shift();
      if (peer){
        this.trigger(EvType.PeerLeave, peer)
      }
    }
    this.peerStatus[publicKey] = status;
  }
  // cntPeerStatus for a remote.
  cntPeerStatus(publicKey, status) {
    return Object.keys(this.peerStatus).filter((k)=>{
      return this.peerStatus[k]===status;
    }).length;
  }

  //renewHandle renews and handle whecking its uniquness
  // according to our current peer list.
  // It then triggers a challenge sequence to become accepted.
  renewHandle() {
    var newHandle = "";
    const validPeers = this.peers.filter(this.iAccepted);
    if (validPeers.length>0){
      var uniq = false;
      while(!uniq) {
        newHandle = this.makeid(5);
        var k = validPeers.filter(this.isHandle(newHandle))
        uniq = k.length===0;
      }
    }
    this.changeHandle(newHandle)
  }

  // changeHandle handles the handle renewing,
  // it verifies that the new handle is uniq, or
  // shows a notficiation error.
  // It then re challenge each peer with the new handle.
  changeHandle(newHandle) {
    if (newHandle===this.me.handle) {
      return
    }
    var uniq = false;
    const validPeers = this.peers.filter(this.iAccepted);
    var k = validPeers.filter(this.isHandle(newHandle))
    uniq = k.length===0;
    if(!uniq){
      this.trigger(EvType.Error, "Your handle is already taken by another peer, change your nickname");
      return false
    }
    this.trigger(EvType.RenewMyHandle, newHandle)
    const bPub = this.mycrypto.publicKey();
    this.me.handle = newHandle;
    this.peers.filter( this.isPubKey(bPub) ).map( (p) => {
      p.handle = newHandle;
    })
    this.peers.filter( this.notPubKey(bPub) ).map( (p) => {
      this.login(p.publicKey)
    })
    return true
  }

  makeid(length) {
     var result           = '';
     var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
     var charactersLength = characters.length;
     for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
     }
     return result;
  }
  elapsed(since){
    var elapsed = new Date() - Date.parse(since);
    var elapsedSec = Math.round(elapsed/1000);
    return elapsedSec
  }
  isBefore(date, maxSec){
    var elapsed = this.elapsed(date)
    return elapsed > maxSec
  }
  iAccepted(){
    return (p) => {
      return this.isPeerStatus(p.publicKey, ChResults.OK)
    }
  }
  withKey(publicKey){
    return (k) => {
      return !!k.key;
    }
  }
  isSharedPubkey(publicKey){
    return (k) => {
      return k.key && k.key.publicKey===publicKey
    }
  }
  notFrom(pubKey){
    return (p) => {
      return p.from!==pubKey;
    }
  }
  isFrom(pubKey){
    return (p) => {
      return p.from===pubKey;
    }
  }
  notPubKey(pubKey){
    return (p) => {
      return p.publicKey!==pubKey;
    }
  }
  isPubKey(pubKey){
    return (p) => {
      return p.publicKey===pubKey;
    }
  }
  isHandle(handle){
    return (p) => {
      return p.handle===handle;
    }
  }
  sortBySince(a, b) {
      const aSince = Date.parse(a.since)
      const bSince = Date.parse(a.since)
      if (aSince < bSince) {
        return -1;
      } else if (aSince > bSince) {
        return 1;
      }
      return 0;
  }
  sortByHandle(a, b) {
    if (a.handle < b.handle) {
        return -1;
    } else if (a.handle > b.handle) {
        return 1;
    }
    return 0;
  }
}

module.exports = {
  Whisper, ChResults, EvType, MsgType, WhisperOpts
}
