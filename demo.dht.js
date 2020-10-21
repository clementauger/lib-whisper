// It works well with mdns. It did not work well with the wan DHT.

// const wtf = require('wtfnode');

const process = require('process');

const { LibP2PTransport } = require("./transport/libp2p")
const { Whisper, Crypters } = require("./whisper")
const { Peer } = require("./peer")
const { CryptoTransport } = require("./cryptotransport")
const Codec = require("./transport/codec");

function waitGroup(done, n) {
  var i = 0;
  var ret = function(){
    i++;
    if (i === n) {
      done();
    }
  }
  return ret
}

const debug = false;
const codec = Codec.Json;
const addr = "127.0.0.1";
const withMDNS = !false;
const withDHT = !true;
const wanDHT = !true;

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

var port = 10000;

( async () => {


  async function newPeer(handle){
    const crypter = Crypters.NoCrypto
    const keys = await crypter.create()
    const shared = await crypter.create()
    return new Peer(
      new Whisper({
        transport: new CryptoTransport({
          crypter:crypter, keys:keys, shared:shared,
          transport:new LibP2PTransport({
            codec: codec,
            mdns: withMDNS, // mdns is sufficient for LAN
            dht: withDHT,
            bootstrap: wanDHT && bootstrapers, // boostrap is only required for the dht.
          })
        }),
        roomID: "room id",
        roomPwd: "room pwd",
        handle: handle,
        keys:keys,
        shared:shared,
      }),
    );
  }

  const bob = await newPeer("bob");
  const alice = await newPeer("alice");

  bob.on("peer.accept", (peer) => { console.log("bob accept peer", peer)})
  alice.on("peer.accept", (peer) => { console.log("alice accept peer", peer)})

  bob.on("message", (m, p)=>{ console.log("bob rcv:", m, "from", p.handle); })
  alice.on("message", (m, p)=>{ console.log("alice rcv:", m, "from", p.handle); })

  const wg = waitGroup(()=>{
    bob.broadcast({type:"message", data :"hi"})
    alice.broadcast({type:"message", data :"yo"})
  }, 2)
  bob.on("peer.accept", wg)
  alice.on("peer.accept", wg)

  const wg2 = waitGroup(()=>{
    console.log("done, disconnecting...")
    setTimeout(async () => {
      await bob.disconnect()
      await alice.disconnect()
      console.log("disconnected! bye!")

      // it takes long time to close.
      // the dht has ongoing requests that prevents the process to exit asap.
      process.exit(0);
      // setInterval(async () => {
      //   wtf.dump()
      //   console.log("")
      // }, 1000)
    }, 1000)
  }, 2)
  bob.on("message", wg2)
  alice.on("message", wg2);

  if (withDHT && !withMDNS && !wanDHT) {
    // This is needed to bootstrap the dht when mdns is false and wanDHT is false too.
    // When mdns is true, the connecton happens when mdns emits peer.found.
    // If you were to use the wan dht via the given boostrap list,
    // peers dont find each other. Dont know why.
    const wg3 = waitGroup(()=>{
      bob.transport.libp2p
        .peerStore.addressBook.set(alice.transport.libp2p.peerId, alice.transport.libp2p.multiaddrs)
      alice.transport.libp2p
        .peerStore.addressBook.set(bob.transport.libp2p.peerId, bob.transport.libp2p.multiaddrs)
    }, 2)
    bob.on("connect", wg3);
    alice.on("connect", wg3);
  }

  await bob.connect()
  // console.log(bob.transport.libp2p.multiaddrs[0].toString())
  // console.log(bob.transport.libp2p.transportManager.getAddrs())
  alice.connect()
})();
