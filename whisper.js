const EventEmitter = require('events');
const {
  Crypters, SumHash
} = require("./crypto.js")

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
  constructor ({
    crypter = Crypters.NoCrypto,
    roomID = "",
    roomPwd = "",
    me = {
      handle: "",
      keys: {publicKey: "", secretKey: ""}
    },
    opts = WhisperOpts,
  }) {
    this.events = new EventEmitter();
    this.msgDispatcher = new EventEmitter();

    this.roomID = roomID;
    this.roomPwd = roomPwd;
    this.opts = opts;


    // {handle, keys:{publicKey, secretKey}}
    this.me = {handle: me.handle};
    this.shared = null;
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

    this.crypter = crypter;

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

  // publicKey returns underlying public key.
  publicKey () {
    return this.me.keys.publicKey;
  }

  // privateKey returns underlying private key.
  privateKey () {
    return this.me.keys.privateKey;
  }

  // connect on given transport. It implements connects, send, on, off.
  // The transport triggers connect, error, disconnect, message events.
  // Upon connection, existing transport is closed,
  // new keys are created if they don t exist,
  // our shared key is added to the list of known keys,
  // and the announce interval is started.
  async connect (transport) {
    if (this.transport){
      this.close();
    }
    this.transport = transport;
    if (!this.me.keys) {
      this.me.keys = await this.crypter.create();
    }
    if (!this.shared) {
      this.shared = await this.crypter.create();
    }
    this.sharedKeys.push({
      from: this.publicKey(),
      key: this.shared,
      since: new Date(),
    });

    this.msgDispatcher.on(MsgType.Announce, this.onAnnounce.bind(this))
    this.msgDispatcher.on(MsgType.Login, this.onLogin.bind(this))
    this.msgDispatcher.on(MsgType.SendInfo, this.onSendInfo.bind(this))
    this.msgDispatcher.on(MsgType.LoginResponse, this.onLoginResponse.bind(this))
    this.transport.on(EvType.Message, this.onTransportMessage.bind(this))
    this.transport.on(EvType.Error, this.onTransportError.bind(this))

    if (transport.addDHTAnnounce) {
      transport.addDHTAnnounce( await SumHash(this.roomID, this.roomPwd) )
    }

    this.announceHandle = setInterval(this.announce.bind(this), this.opts.AnnounceInterval)
    this.announce()
  }

  // close the underlying transport.
  async close () {
    this.msgDispatcher.removeAllListeners(MsgType.Announce)
    this.msgDispatcher.removeAllListeners(MsgType.Login)
    this.msgDispatcher.removeAllListeners(MsgType.LoginResponse)
    this.msgDispatcher.removeAllListeners(MsgType.SendInfo)
    if (this.transport) {
      this.transport.off(EvType.Message)
      this.transport.off(EvType.Error)
      if (this.transport.rmDHTAnnounce) {
        const h = await SumHash(this.roomID, this.roomPwd)
        this.transport.rmDHTAnnounce(h)
      }
    }
    this.transport = null;
    this.sharedKeys = []
    this.peers = []
    clearInterval(this.announceHandle)
  }

  // onTransportError triggers this error handler.
  onTransportError (err) {
    this.trigger(EvType.Error, err)
  }

  _debug(info) {
    this.trigger("debug", info)
  }

  // onTransportMessage decodes input message and triggers the related event handler.
  // every input message must provide a signature (sign field).
  // If the message provides a type fields, it must be an announce packet and be in clear text.
  // Otherwise the message is decrypted, using the corresponding private key of the to field.
  // The decrypted message is an object with a type field.
  // If the decrypted message has a type Login, LoginResponse or SendInfo,
  // it is handled by the internal logic.
  // Otherwise, it is emitted on this whisper instance only if the peer emitter
  // is accepted.
  async onTransportMessage (message) {
    var msg = {};
    if (typeof message !=="object" || !(message instanceof Object)) {
      console.error("got non object from transport", message)
    }
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

    const verify = await this.crypter.verify(msg.sign, msg.from)
    if (!verify){
      return
    }
    if (msg.type && msg.type===MsgType.Announce) {
      this._debug({handle: this.me.handle, type: "message", dir: "rcv", data: msg})
      this.onAnnounce(msg)
      return
    }

    var scleardata = "";
		if (msg.to === this.publicKey()){
      scleardata = await this.crypter.decrypt(msg.data, msg.from, this.me.keys.privateKey).catch(console.error)
		} else {
      var foundkey = this.sharedKeys.filter( isSharedPubkey(msg.to) ).pop()
      if (!foundkey) {
        return
      }
      foundkey = foundkey.key
      scleardata = await this.crypter.decrypt(msg.data, foundkey.publicKey, foundkey.privateKey).catch(console.error)
		}
		if (!scleardata) {
			console.error(this.me.handle, "is shared: ", !!this.sharedKeys.filter( isSharedPubkey(msg.to) ).pop())
			return
		}


		var cleardata = JSON.parse(scleardata);
    if(!cleardata.type) {
      console.error(this.me.handle, "invalid packaet: missing type qualifier")
      return
    }
    this._debug({handle: this.me.handle, type: "message", dir: "rcv", data: cleardata})

    var getListeners = this.msgDispatcher.listeners || this.msgDispatcher.getListeners;
    getListeners = getListeners.bind(this.msgDispatcher)
    if (getListeners(cleardata.type).length>0){
      this.msgDispatcher.emit(cleardata.type, cleardata, msg);
      return
    }
    const peer = this.peers.filter(isPubKey(msg.from)).shift();
    if (peer) {
      this.trigger(cleardata.type, cleardata, peer);
    }
  }

	// _announcePkt creates an announce packet.
	async _announcePkt () {
    const d = new Date();
    const bPub = this.publicKey()
    const h = await SumHash(this.roomID, this.roomPwd, d, bPub)
    return {
      "type": MsgType.Announce,
      "from": bPub,
      "date": d,
      "hash": h,
      "sign": await this.crypter.sign(h, this.privateKey()),
    }
	}

	// announce sends an announce message containing
  // an hash proving we can read associated room.
	async announce () {
    const msg = await this._announcePkt()
    if(this.transport) {
      this.transport.send(msg)
    }
    this.cleanPeers()
	}

	// cleanPeers deletes peers that did not announce twice in a row.
	cleanPeers () {
    const bPub = this.publicKey()
    this.peers = this.peers.filter( notPubKey(bPub) ).filter( (p) => {
      const from = p.publicKey;
      if(from===bPub){
        return true;
      }
      const announce = this.announces[from];
      if (!announce){
        return false;
      }
      if (!isBefore(announce.lastSeen, this.opts.AnnounceTimeout*2)) {
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
  // it triggers a login sequence once every opts.LoginRetry seconds.
  // It checks message's date is not older than this.opts.AnnounceTimeout
	async onAnnounce (msg) {
    const bPub = this.publicKey()
    const from = msg.from
    if (from===bPub) {
      return;
    }
    if (isBefore(msg.date, this.opts.AnnounceTimeout)) {
      return
    }
    const meH = await SumHash(this.roomID, this.roomPwd, msg.date, from);
    const valid = msg.hash===meH;
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
    if (!isNew && !isBefore(this.announces[from].lastLogin, this.opts.LoginRetry)) {
      return
    }
    this.announces[from].lastLogin = new Date()
    this.login(from);
	}

  // nwToken generates and store a new token for given public key and msg type.
  newToken(publicKey, typ) {
    this.trigger(EvType.Negotiating, this.cntNegotiations([MsgType.Login]))
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
    this.trigger(EvType.Negotiating, this.cntNegotiations([MsgType.Login]))
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
    if (isBefore(curNego.since, this.opts.AnnounceTimeout)) {
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
	async login (withPublicKey) {
    const bPub = this.publicKey();
    const tok = this.newToken(withPublicKey, MsgType.Login)
    const msg = {
      "type": MsgType.Login,
      "hash": await SumHash(this.roomID, this.roomPwd, tok.token, tok.type, bPub),
      "token":tok.token,
    }
    this.trigger(EvType.Negotiating, this.cntNegotiations([MsgType.Login]))
    await this.send(msg, withPublicKey)
	}

	// login handles login packets. it verifies for the packet.hash, if it is valid,
  // it sends the send-info. Otherwise it issues a login-response error packet.
	async onLogin (cleardata, data) {
    const meH = await SumHash(this.roomID, this.roomPwd, cleardata.token, MsgType.Login, data.from)
    const a = cleardata.hash===meH
    if (!a) {
      this.issueLoginResponse(data.from, cleardata.token, ChResults.InvalidHash)
      return
    }
    this.issueSendInfo(data.from, cleardata.token);
	}

  // issueSendInfo sends a send-info packet.
  // Token is provided by the previous login message.
  async issueSendInfo(peerPublicKey, loginToken) {
    const bPub = this.publicKey();
    var data = {}
    data.type = MsgType.SendInfo
    const token = this.newToken(peerPublicKey, MsgType.SendInfo)
    data.mytoken = token.token
    data.token = loginToken
    data.hash = await SumHash(this.roomID, this.roomPwd, loginToken, token.token, token.type, bPub)
    data.handle = this.me.handle
    data.shared = this.shared
    await this.send(data, peerPublicKey);
  }

	// onSendInfo handles send-info packets.
  // the send-info message must provide a previsouly
  // generated Login token.
  // if the packet.hash is valid, it tries to insert/update the peer.
  // if the peer is accepted, it issues an accept message to the peer.
	async onSendInfo(cleardata, data) {
    const nego = this.validateToken(data.from, MsgType.Login, cleardata.token)
    if (!nego) {
      return
    }

    const meH = await SumHash(this.roomID, this.roomPwd, nego.token, cleardata.mytoken, MsgType.SendInfo, data.from);
    const a = cleardata.hash===meH
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
    const bPub = this.publicKey();
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
      // console.log(this.me.handle, this.publicKey(), "  peer add ", peer.handle, peer.publicKey)
      this.trigger(EvType.PeerAccept, JSON.parse(JSON.stringify(peer)))
    }else if (peer.handle != cleardata.handle) {
      const oldHandle = peer.handle;
      peer.handle = cleardata.handle;
      // console.log(this.me.handle, this.publicKey(), "  peer rename ", peer.handle, peer.publicKey)
      this.trigger(EvType.PeerRenewHandle, peer, oldHandle)
    }else{
      // console.log(this.me.handle, this.publicKey(), "  peer refreshed ", peer.handle, peer.publicKey)
    }
    this.setPeerStatus(data.from, ChResults.OK)
    this.checkRoomAccept()
	}

  // issueLoginResponse sends a login-response packet.
  // Token is provided by the previous login message.
  // It notifies the remote peer its status for us.
  async issueLoginResponse(peerPublicKey, token, result, opts) {
    const bPub = this.publicKey();
    var data = opts || {}
    data.type = MsgType.LoginResponse
    data.token = token
    data.result = result
    await this.send(data, peerPublicKey);
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
      this.trigger(EvType.Negotiating, this.cntNegotiations([MsgType.Login]))
      return
    }
    this.peerAddUpdate(cleardata, data)
    this.trigger(EvType.Negotiating, this.cntNegotiations([MsgType.Login]))
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
        shared:this.shared
      }
    );
  }

	// send a private message.
	async send(msg, b64ToPubKey) {
    if (this.transport){
      this._debug({handle: this.me.handle, type: "message", dir: "snd", data: {to:b64ToPubKey,data:msg}})
  		const data = await this.crypter.encrypt(JSON.stringify(msg), b64ToPubKey, this.privateKey());
  		const bPub = this.publicKey();
  		const sign = await this.crypter.sign(await SumHash(data), this.privateKey());
  		const err = this.transport.send({ "data": data, "from": bPub, "to": b64ToPubKey, "sign":sign });
      if (err){
        console.error(this.me.handle, this.publicKey(), " transport err:", err)
      }
    }
	}

	// broadcast, encrypt and authenticate a message using a sharedKey.
	async broadcast (msg) {
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
		const bPub = this.publicKey();
		const data = await this.crypter.encrypt(JSON.stringify(msg), key.key.publicKey, key.key.privateKey);
    const sign = await this.crypter.sign(await SumHash(data), this.privateKey());
    this._debug({handle: this.me.handle, type: "message", dir: "snd", data: {to:key.key.publicKey, data:data}})
    this.transport.send({ "data": data, "from": bPub, "to": key.key.publicKey, "sign":sign });
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
    const bPub = this.publicKey();
    this.me.handle = newHandle;
    this.peers.filter( isPubKey(bPub) ).map( (p) => {
      p.handle = newHandle;
    })
    var that = this;
    this.peers.filter( notPubKey(bPub) ).map( (p) => {
      that.login(p.publicKey)
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
  Whisper, ChResults, EvType, MsgType, WhisperOpts, Crypters, SumHash
}
