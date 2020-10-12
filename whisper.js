const EventEmitter = require('events');

var MsgType = MsgType || {};
MsgType.Announce = "announce";
MsgType.Login = "login";
MsgType.LoginResponse = "login-res";
MsgType.SendInfo = "send-info";
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
  LoginRetry: 10,
  AnnounceTimeout: 60 * 5,
  AnnounceInterval: 1000,
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
      this.me.handle = makeid(5)
    }
    this.isRenewingHandle = false;
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
    this.msgDispatcher.on(MsgType.SendInfo, this.onSendInfo.bind(this))
    this.msgDispatcher.on(MsgType.LoginResponse, this.onLoginResponse.bind(this))
    this.transport.on(EvType.Message, this.onTransportMessage.bind(this))
    this.transport.on(EvType.Error, this.onTransportError.bind(this))

    this.announceHandle = setInterval(this.announce.bind(this), WhisperOpts.AnnounceInterval)
    this.announce()
  }

  // close the underlying transport.
  // triggers diconnect event.
  close () {
    this.msgDispatcher.removeAllListeners(MsgType.Announce)
    this.msgDispatcher.removeAllListeners(MsgType.Login)
    this.msgDispatcher.removeAllListeners(MsgType.LoginResponse)
    this.msgDispatcher.removeAllListeners(MsgType.SendInfo)
    if (this.transport) {
      this.transport.off(EvType.Message)
      this.transport.off(EvType.Error)
    }
    this.transport = null;
    this.sharedKeys = []
    this.peers = []
    clearInterval(this.announceHandle)
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
      foundkey = this.sharedKeys.filter( isSharedPubkey(msg.to) ).pop()
      if (foundkey) {
        foundkey = foundkey.key
      }
		}
    if (!foundkey) {
      // this._debug({handle: this.me.handle, type: "no-keys", dir: "rcv", data: msg})
      return
    }

    var k = new this.crypter(foundkey)
    const scleardata = k.decrypt(msg.data, msg.nonce, msg.from)
		if (!scleardata) {
			console.error(this.me.handle, "msg not decrypted ", msg, "with key", foundkey)
			return
		}


		var cleardata = JSON.parse(scleardata);
    if(!cleardata.type) {
      console.error(this.me.handle, "invalid packaet: missing type qualifier")
      return
    }
    this._debug({handle: this.me.handle, type: "message", dir: "rcv", data: cleardata})

    if (cleardata.type===MsgType.Message){
      const peer = this.peers.filter(isPubKey(msg.from)).shift();
      if (peer) {
        this.trigger(cleardata.type, cleardata, peer);
      }
      return
    }

    var getListeners = this.msgDispatcher.listeners || this.msgDispatcher.getListeners;
    getListeners = getListeners.bind(this.msgDispatcher)
    if (getListeners(cleardata.type).length>0){
      this.msgDispatcher.emit(cleardata.type, cleardata, msg);
      return
    }
    this.trigger(cleardata.type, cleardata, msg, peer);
  }

	// announce sends an announce message containing
  // an hash proving we can read associated room.
	announce () {
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
    if(this.transport) {
      this.transport.send(msg)
    }
    this.cleanPeers()
	}

	// cleanPeers deletes peers that did not announce twice in a row.
	cleanPeers () {
    const bPub = this.mycrypto.publicKey()
    this.peers = this.peers.filter( notPubKey(bPub) ).filter( (p) => {
      const from = p.publicKey;
      if(from===bPub){
        return true;
      }
      const announce = this.announces[from];
      if (!announce){
        return false;
      }
      if (!isBefore(announce.lastSeen, WhisperOpts.AnnounceTimeout*2)) {
        return true;
      }
      this.sharedKeys = this.sharedKeys.filter( notFrom(from) )
      delete(this.tokens[from])
      delete(this.announces[from])
      delete(this.peerStatus[from])
      this.trigger(EvType.PeerLeave, p)
      return false;
    })
	}

	// onAnnounce handles peers announces.
  // It verifies the given hash, if it is valid,
  // it triggers a login sequence once every WhisperOpts.LoginRetry seconds.
	onAnnounce (msg) {
    const bPub = this.mycrypto.publicKey()
    const from = msg.publicKey
    if (from===bPub) {
      return;
    }
    if (isBefore(msg.date, WhisperOpts.AnnounceTimeout)) {
      return
    }
    const valid = msg.hash===this.mycrypto.hash(this.roomID, this.roomPwd, msg.date, from)
    if (!valid){
      return
    }
    var isNew = false;
    if (!this.announces[from]){
      this.announces[from] = {
        lastSeen: new Date(),
        lastLogin: new Date(),
      }
      isNew = true
    }
    this.announces[from].publicKey = msg.publicKey;
    this.announces[from].date = msg.date;
    this.announces[from].hash = msg.hash;
    this.announces[from].lastSeen = new Date();
    if (!isNew && !isBefore(this.announces[from].lastLogin, WhisperOpts.LoginRetry)) {
      return
    }
    this.announces[from].lastLogin = new Date()
    this.login(from);
	}

  // nwToken generates and store a new token for given public key and msg type.
  newToken(publicKey, typ) {
    this.trigger(EvType.Negotiating, this.cntNegotiations())
    if (!this.tokens[publicKey]) {
      this.tokens[publicKey] = {}
    }
    if (!this.tokens[publicKey][typ]) {
      this.tokens[publicKey][typ] = {}
    }
    const t = makeid(16);
    const tok = {
      token: t,
      since: new Date(),
      type: typ,
    }
    this.tokens[publicKey][typ][t] = tok
    return {
      token: tok.token,
      since: tok.since.toISOString(),
      type: tok.type,
    };
  }

  // validateToken verifies the given token exists for given public key and msg type.
  // if it is valid, the token is deleted.
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
    if (isBefore(curNego.since, WhisperOpts.AnnounceTimeout)) {
      console.error("invalid token: lifetime exceeded");
      return false
    }
    return {
      token: curNego.token,
      since: curNego.since.toISOString(),
      type: curNego.type,
    }
  }

  // cntNegotiations counts the number of tokens for a given peer.
  cntNegotiations(typs) {
    var cnt = 0;
    Object.keys(this.tokens).map((pbk)=>{
      if(!typs) { typs = Object.keys(this.tokens[pbk]) }
      typs.map( (typ) => {
        if (this.tokens[pbk][typ]) {
          cnt += Object.keys(this.tokens[pbk][typ]).length
        }
      })
    });
    return cnt
  }

  // checkRoomAccept tries to compute our status given
  // peers results status after login.
  // The majority of the peers i accepted can be insufficient,
  // duplicated handle, some error or accepted.
  // Depending of the result, this peer will change its handle and try to re login,
  // or trigger an error to notify the login failed,
  // or a room accept event.
  checkRoomAccept() {
    var totalOk = this.cntPeerStatus(ChResults.OK);
    if (totalOk<1) {
      return
    }
    const majority = Math.round(totalOk/2);

    var invalidHash = this.cntPeerStatus(ChResults.InvalidHash);
    var invalidSealedAuth = this.cntPeerStatus(ChResults.InvalidSealedAuth);
    var handleKo = this.cntPeerStatus(ChResults.DuplicateHandle);
    const totalKo = invalidHash + invalidSealedAuth + handleKo;

    if (handleKo>majority || invalidSealedAuth>majority) {
      this.renewHandle()
      return
    }else if (totalKo>majority) {
      this.trigger(EvType.Error, "You were not accepted to the room");
      return
    }
    this.isRenewingHandle = false;
    this.trigger(EvType.Accept);
  }

	// login sends a login packet. It provides a hash of the room id / pwd,
  // and a token that the remote peer can use to answer.
	login (withPublicKey) {
    const bPub = this.mycrypto.publicKey();
    const tok = this.newToken(withPublicKey, MsgType.Login)
    const msg = {
      "type": MsgType.Login,
      "hash": this.mycrypto.hash(this.roomID, this.roomPwd, tok.token, tok.type, bPub),
      "token":tok.token,
    }
    this.trigger(EvType.Negotiating, this.cntNegotiations())
    this.send(msg, withPublicKey)
	}

	// login handles login packets. it verifies for the packet.hash, if it is valid,
  // it sends the send-info. Otherwise it issues a login-response error packet.
	onLogin (cleardata, data) {
    const a = cleardata.hash===this.mycrypto.hash(this.roomID, this.roomPwd, cleardata.token, MsgType.Login, data.from)
    if (!a) {
      this.issueLoginResponse(data.from, cleardata.token, ChResults.InvalidHash)
      return
    }
    this.issueSendInfo(data.from, cleardata.token);
	}

  // issueSendInfo sends a send-info packet.
  // Token is provided by the previous login message.
  issueSendInfo(peerPublicKey, loginToken) {
    const bPub = this.mycrypto.publicKey();
    var data = {}
    data.type = MsgType.SendInfo
    const token = this.newToken(peerPublicKey, MsgType.SendInfo)
    data.mytoken = token.token
    data.token = loginToken
    data.hash = this.mycrypto.hash(this.roomID, this.roomPwd, loginToken, token.token, token.type, bPub)
    data.handle = this.me.handle
    data.shared = this.mesharedcrypto.get()
    this.send(data, peerPublicKey);
  }

	// onSendInfo handles send-info packets.
  // the send-info message must provide a previsouly
  // generated Login token.
  // if the packet.hash is valid, it tries to insert/update the peer.
  // if the peer is accepted, it issues an accept message to the peer.
	onSendInfo(cleardata, data) {
    const nego = this.validateToken(data.from, MsgType.Login, cleardata.token)
    if (!nego) {
      return
    }
    this.trigger(EvType.Negotiating, this.cntNegotiations())

    const a = cleardata.hash===this.mycrypto.hash(this.roomID, this.roomPwd, nego.token, cleardata.mytoken, MsgType.SendInfo, data.from);
    if (!a) {
      return
    }

    this.peerAddUpdate(cleardata, data)

    if(this.isPeerStatus(data.from, ChResults.OK)){
      this.issueAccept(data.from, cleardata.mytoken)
    }
	}

	// peerAddUpdate try to insert/update a peer into our list,
  // if the peer handle is duplicated, it notifies the peer.
  // otherwise, it adds the peer to our peer list, and its sahred keys
  // are added to our list of shared keys.
  // if the peer exists in out list, but the handle is different,
  // a peer.renewhandle event is emitter.
	peerAddUpdate(cleardata, data) {
    const bPub = this.mycrypto.publicKey();
    var isNew = false;
    var peer = this.peers.filter( isPubKey(data.from) ).shift()
    if (!peer){
      isNew = true;
      peer = {
        handle: cleardata.handle,
        publicKey: data.from,
      }
    }
    const conflictPeerHandle = this.peers.filter( notPubKey(peer.publicKey) )
      .filter( isHandle(peer.handle) ).shift();

    if (conflictPeerHandle) {
      this.issueInvalidPeerHandle(peer, cleardata.mytoken, {handle:peer.handle})
      this.checkRoomAccept()
      return
    }
    if (this.me.handle===peer.handle) {
      this.issueInvalidPeerHandle(peer, cleardata.mytoken, {handle:peer.handle})
      this.checkRoomAccept()
      return
    }

    this.sharedKeys = this.sharedKeys.filter( notFrom(data.from) )
    this.sharedKeys.push({from: data.from, key: cleardata.shared, since: new Date()});
    if (isNew) {
      this.peers.push(peer);
      // console.log(this.me.handle, this.mycrypto.publicKey(), "  peer add ", peer.handle, peer.publicKey)
      this.trigger(EvType.PeerAccept, JSON.parse(JSON.stringify(peer)))
    }else if (peer.handle != cleardata.handle) {
      const oldHandle = peer.handle;
      peer.handle = cleardata.handle;
      // console.log(this.me.handle, this.mycrypto.publicKey(), "  peer rename ", peer.handle, peer.publicKey)
      this.trigger(EvType.PeerRenewHandle, peer, oldHandle)
    }else{
      // console.log(this.me.handle, this.mycrypto.publicKey(), "  peer refreshed ", peer.handle, peer.publicKey)
    }
    this.setPeerStatus(data.from, ChResults.OK)
    this.checkRoomAccept()
	}

  // issueLoginResponse sends a login-response packet.
  // Token is provided by the previous login message.
  // It notifies the remote peer its status for us.
  issueLoginResponse(peerPublicKey, token, result, opts) {
    const bPub = this.mycrypto.publicKey();
    var data = opts || {}
    data.type = MsgType.LoginResponse
    data.token = token
    data.result = result
    this.send(data, peerPublicKey);
  }

  // issueInvalidPeerHandle sends a login-reponse.
  // Token is provided by the previous login message.
  // It notifies the remote peer its handle is duplicated for us.
  issueInvalidPeerHandle(peer, token, opts) {
    this.issueLoginResponse(
      peer.publicKey,
      token,
      ChResults.DuplicateHandle,
      opts
    );
  }

  // onLoginResponse receives the login-response message, the reponse message must provide a previsouly
  // generated Login token.
  // If the token is valid, the peer status of us is locally updated.
	onLoginResponse (cleardata, data) {
    var nego = this.validateToken(data.from, MsgType.Login, cleardata.token)
    if (!nego) {
      nego = this.validateToken(data.from, MsgType.SendInfo, cleardata.token)
      if (!nego) {
        return
      }
    }
    if (cleardata.result!==ChResults.OK) {
      this.setPeerStatus(data.from, cleardata.result)
      this.checkRoomAccept()
      this.trigger(EvType.Negotiating, this.cntNegotiations())
      return
    }
    this.peerAddUpdate(cleardata, data)
    this.trigger(EvType.Negotiating, this.cntNegotiations())
	}

  // issueAccept sends an accept message.
  // Token is provided by the previous send-info message.
  // It sends our handle, shared keys and a send-info token.
  issueAccept(peerPublicKey, token) {
    this.issueLoginResponse(
      peerPublicKey,
      token,
      ChResults.OK,
      {
        mytoken:this.newToken(peerPublicKey, MsgType.SendInfo).token,
        handle:this.me.handle,
        shared:this.mesharedcrypto.get()
      }
    );
  }

	// send a private message.
	send(msg, b64ToPubKey) {
    if (this.transport){
      this._debug({handle: this.me.handle, type: "message", dir: "snd", data: {to:b64ToPubKey,data:msg}})
  		const nonce = this.mycrypto.newNonce();
  		const data = this.mycrypto.encrypt(JSON.stringify(msg), nonce, b64ToPubKey);
  		const bPub = this.mycrypto.publicKey();
  		const err = this.transport.send({ "data": data, "nonce": nonce, "from": bPub, "to": b64ToPubKey });
      if (err){
        console.error(this.me.handle, this.mycrypto.publicKey(), " transport err:", err)
      }
    }
	}

	// broadcast, encrypt and authenticate a message using a sharedKey.
	broadcast (msg) {
    const oldest = this.peers.filter(iAccepted.bind(this)).sort(sortBySince).pop();
    if (!oldest) {
      console.error(this.me.handle, "could not find a peer to send message")
      return
    }
    const key = this.sharedKeys.filter( withKey ).filter( isFrom(oldest.publicKey) ).pop();
    if (!key) {
      console.error(this.me.handle, "could not find peer shared keys to send message")
      return
    }
    if (!key.key) {
      console.error(this.me.handle, "could not get peer shared keys to send message")
      return
    }
		const bPub = this.mycrypto.publicKey();
		var crypto = new this.crypter(key.key);
		const nonce = crypto.newNonce();
		const data = this.mycrypto.encrypt(JSON.stringify(msg), nonce, crypto.publicKey());
    this._debug({handle: this.me.handle, type: "message", dir: "snd", data: {to:key.key.publicKey,data:data}})
		this.transport.send({ "data": data, "nonce": nonce, "from": bPub, "to": key.key.publicKey });
	}

	// broadcastDirect send a private message to each accepted peer.
	broadcastDirect (msg) {
    var that = this;
    this.peers.filter(iAccepted.bind(this)).map( (p)=>{
      that.send(msg, p.publicKey)
    })
	}

  // isPeerStatus returns true if the peer responded with given status
  isPeerStatus(publicKey, status) {
    return this.peerStatus[publicKey] && this.peerStatus[publicKey]===status;
  }

  // setPeerStatus saves the status returned by a peer.
  setPeerStatus(publicKey, status) {
    if (status!==ChResults.OK && this.peerStatus[publicKey]===ChResults.OK) {
      const peer = this.peers.filter( isPubKey(publicKey) ).shift();
      if (peer){
        this.trigger(EvType.PeerLeave, peer)
      }
    }
    this.peerStatus[publicKey] = status;
  }

  // cntPeerStatus returns the number of peer with given status.
  cntPeerStatus(status) {
    return Object.keys(this.peerStatus).filter((k)=>{
      return this.peerStatus[k]===status;
    }).length;
  }

  //renewHandle renews and handle whecking its uniquness
  // according to our current peer list.
  // It then triggers a challenge sequence to become accepted.
  renewHandle() {
    if (this.isRenewingHandle) {
      return
    }
    this.isRenewingHandle = true;
    var newHandle = "";
    const validPeers = this.peers.filter(iAccepted.bind(this));
    if (validPeers.length>0){
      var uniq = false;
      while(!uniq) {
        newHandle = makeid(5);
        var k = validPeers.filter(isHandle(newHandle))
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
    const validPeers = this.peers.filter(iAccepted.bind(this));
    var k = validPeers.filter(isHandle(newHandle))
    uniq = k.length===0;
    if(!uniq){
      this.trigger(EvType.Error, "Your handle is already taken by another peer, change your nickname");
      return false
    }
    this.trigger(EvType.RenewMyHandle, newHandle)
    const bPub = this.mycrypto.publicKey();
    this.me.handle = newHandle;
    this.peers.filter( isPubKey(bPub) ).map( (p) => {
      p.handle = newHandle;
    })
    this.peers.filter( notPubKey(bPub) ).map( (p) => {
      this.login(p.publicKey)
    })
    return true
  }
}


function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}
function elapsed(since){
  var el = new Date() - Date.parse(since);
  var elapsedSec = Math.round(el/1000);
  return elapsedSec
}
function isBefore(date, maxSec){
  var el = elapsed(date)
  return el > maxSec
}
function iAccepted(){
  return (p) => {
    return this.isPeerStatus(p.publicKey, ChResults.OK)
  }
}
function withKey(publicKey){
  return (k) => {
    return !!k.key;
  }
}
function isSharedPubkey(publicKey){
  return (k) => {
    return k.key && k.key.publicKey===publicKey
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
function notPubKey(pubKey){
  return (p) => {
    return p.publicKey!==pubKey;
  }
}
function isPubKey(pubKey){
  return (p) => {
    return p.publicKey===pubKey;
  }
}
function isHandle(handle){
  return (p) => {
    return p.handle===handle;
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

module.exports = {
  Whisper, ChResults, EvType, MsgType, WhisperOpts
}
