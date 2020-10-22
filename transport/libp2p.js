'use strict';

// const util = require('util')
const { fromStream } = require('streaming-iterables')
const { PassThrough } = require('stream')

const util = require('util');
const EventEmitter = require('events');
const Codec = require("./codec")
const { Err } = require('./errors');
const { EvType } = require('./events.type');

const Libp2p = require('libp2p')
const MulticastDNS = require('libp2p-mdns')
const KadDHT = require('libp2p-kad-dht')
const Bootstrap = require('libp2p-bootstrap')
const TCP = require('libp2p-tcp')
const Mplex = require('libp2p-mplex')
const { NOISE } = require('libp2p-noise')

const { isBrowser } = require("browser-or-node");
const wrtc = require('wrtc')
const Websockets = require('libp2p-websockets')

// need to figure out how to use those.
// const WebSocketStar = require('libp2p-websocket-star')
// const WebRTCStar = require('libp2p-webrtc-star')
// const DelegatedPeerRouter = require('libp2p-delegated-peer-routing')
// const DelegatedContentRouter = require('libp2p-delegated-content-routing')

const CID = require('cids')
const multihashing = require('multihashing-async')
const stringToCID = async (t)=> {
  const bytes = new util.TextEncoder('utf8').encode(t)
  const hash = await multihashing(bytes, 'sha2-256')
  return new CID(1, 'dag-pb', hash)
}

const pipe = require('it-pipe')
const all = require('it-all')
const lp = require('it-length-prefixed')

// some bootstrappers you might try
const bootstrapers = [
  '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
  '/ip4/104.236.176.52/tcp/4001/p2p/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z',
  '/ip4/104.236.179.241/tcp/4001/p2p/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
  '/ip4/162.243.248.213/tcp/4001/p2p/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
  '/ip4/128.199.219.111/tcp/4001/p2p/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
  '/ip4/104.236.76.40/tcp/4001/p2p/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
  '/ip4/178.62.158.247/tcp/4001/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
  '/ip4/178.62.61.185/tcp/4001/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
  '/ip4/104.236.151.122/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx'
]

class LibP2PTransport {
  constructor ({
    protocol = "/whisper/0.0.0",
    addr = "/ip4/0.0.0.0/tcp/0",
    codec = Codec.Json,
    mdns = true,
    dht = false,
    announceInterval = 1000,
    lookupInterval = 1000,
    bootstrap = [],
  }) {
    this.events = new EventEmitter();
    this.socket = null;
    this.codec = codec;
    this.addr = addr;
    this._mdns = mdns;
    this._dht = dht;
    this._bootstrap = bootstrap;
    this.protocol = protocol;
    this._lookupInterval = lookupInterval;
    this._announceInterval = announceInterval;
    this._dhtAnnounces = [];
    this._onPeer = this._onPeer.bind(this);
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


  // connect the websocket.
  async connect () {
    if (this.libp2p!=null){
      this.close();
    }

    var peerDiscovery = [];
    if (this._mdns) {
      peerDiscovery.push(MulticastDNS)
    }
    if (this._bootstrap.length) {
      peerDiscovery.push(Bootstrap)
    }

    var dht = null;
    if(this._dht) {
      dht = KadDHT
    }

    var transports = [
      Websockets,
    ]
    if (!isBrowser) {
      transports.push(TCP)
    }
    this.libp2p = await Libp2p.create({
      addresses: {
        listen: [this.addr]
      },
      modules: {
        transport: transports,
        streamMuxer: [ Mplex ],
        connEncryption: [ NOISE ],
        peerDiscovery: peerDiscovery,
        dht: dht,
      },
      config: {
        peerDiscovery: {
          autoDial: true,
          [MulticastDNS.tag]: {
            broadcast: true,
            interval: 1000,
            enabled: true
          },
          [Bootstrap.tag]: {
            interval: 1000,
            enabled: this._bootstrap.length>0,
            list: this._bootstrap || [],
          }
        },
        dht: {
          enabled: this._dht,
        },
      }
    })
    // see also:
    // https://github.com/libp2p/js-libp2p/blob/v0.28.4/doc/CONFIGURATION.md#setup-with-content-and-peer-routing

    var that = this;
    const protocol = this.protocol;
    this.encoder = this.codec.encoder();
    this.encoder.on("error", console.error);
    this.libp2p.handle(protocol,  async (z) => {
      const stream = z.stream
      const peerID = z.connection.remotePeer.toB58String();
      this._handleOuputStream(peerID, stream)
    })
    this.libp2p.peerStore.on('peer', this._onPeer)

    this.libp2p.on('error', function(e) {
      that.trigger(EvType.Error, e);
    });

    await this.libp2p.start()
    that.trigger(EvType.Connect);

    if(this._dht) {
      this._announceHandle = setInterval(this._announce.bind(this), this._announceInterval)
      this._lookupHandle = setInterval(this._lookup.bind(this), this._lookupInterval)
      this._announce()
      this._lookup()
    }

    return this
  };

  async _onPeer (peerID) {
    const sPeerID = peerID.toB58String()
    const res = await this.libp2p.dialProtocol(peerID, this.protocol).catch((err)=>{
      // console.error("dial err:",err)
    })
    if (!res) {
      return
    }
    this._handleInputStream(sPeerID, res.stream)
  }

  async _handleInputStream (peerID, stream) {
    var that = this;

    const decoder = this.codec.decoder();
    decoder.on("error", console.error);
    decoder.on("data", (data)=>{
      that.trigger(EvType.Message, data);
    })
    await pipe(stream.source, lp.decode(),
     async function (source) {
       for await (const msg of source) {
         if (that.codec.binary) {
           decoder.write(msg.slice())
           continue
         }
         decoder.write(msg.toString())
       }
     }
    ).catch((err)=>{
      console.error("_onPeer err:", err)
    });
    decoder.end()
    stream.close()
  }

  async _handleOuputStream (peerID, stream) {
    var that = this;

    that.trigger("peer");

    const d = new PassThrough()
    that.encoder.pipe(d);
    await pipe(fromStream(d), lp.encode(), stream)

    this.encoder.unpipe(d)
    d.destroy()
    stream.close()
  }

  async addDHTAnnounce (announce) {
    const cid = await stringToCID(announce)
    this._dhtAnnounces.push(cid);
  }

  async rmDHTAnnounce (announce) {
    const cid = await stringToCID(announce)
    this._dhtAnnounces = this._dhtAnnounces.filter((c)=>{return c!==cid})
  }

  async _announce () {
    if (this._isAnnouncing) {
      return
    }
    this._isAnnouncing = true
    if (this._dhtAnnounces.length) {
      const routing = this.libp2p.contentRouting;
      await all( this._dhtAnnounces.map(routing.provide.bind(routing)) ).catch((err)=>{
        console.error("provide err:", err)
      });
    }
    this._isAnnouncing = false
  }

  async _lookup () {
    if (this._isLookingup) {
      return
    }
    this._isLookingup = true
    if (this._dhtAnnounces.length) {
      const routing = this.libp2p.contentRouting;
      const providers = await all( this._dhtAnnounces.map((a)=>{
        return routing.findProviders(a, { timeout: 5000 })
      }) ).catch((err)=>{
        console.error("findProviders err:", err)
      });
      providers.map( async (p) =>{
        if (!p.id) {
          return // it might be an Object [AsyncGenerator] {} (??)
        }
        console.log('Found provider:', p.id.toB58String())
        that._onPeer(p.id)
      })
    }
    this._isLookingup = false
  }

  // send a message
  send (msg) {
		if (!this.libp2p){
      return Err.SocketClosed;
    }
		try {
			this.encoder.write(msg);
		} catch (e) {
      console.error(e)
      this.trigger("error", e)
      return e
		};
    return null;
  }

  async close () {
    clearInterval(this._announceHandle)
    clearInterval(this._lookupHandle)
    if (this.encoder) {
      this.encoder.end();
      this.encoder.removeAllListeners("data")
    }
    this._dhtAnnounces = [];
    if (this.libp2p){
      this.libp2p.peerStore.off('peer', this._onPeer)
      this.libp2p.unhandle(this.protocol)
      await this.libp2p.stop();
      this.libp2p = null;
      this.trigger(EvType.Disconnect);
    }
  }
}

module.exports = {
  LibP2PTransport
}
