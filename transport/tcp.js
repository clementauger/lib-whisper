const net = require('net');
const EventEmitter = require('events');
const Codec = require("./codec")

const { Err } = require('./errors');
const { EvType } = require('./events.type');

class TcpTransport {
  constructor ({
    port = 0,
    addr = "",
    codec = Codec.Json,
    reconnectTimeout = 0,
  }) {
    this.events = new EventEmitter();
    this.reconnectTimeout = reconnectTimeout;
    this.reconnectHandle = null;
    this.socket = null;
    this.codec = codec;
    this.port = port;
    this.addr = addr;
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
    if (this.socket!=null){
      this.close();
    }
    var that = this;
    this.socket = new net.Socket();
    if(!this.codec.binary) {
      this.socket.setEncoding('utf8');
    }
    this.encoder = this.codec.encoder();
    this.encoder.pipe(this.socket)
    const decoder = this.codec.decoder();
    this.encoder.on("error", console.error);
    decoder.on("data", (data)=>{
      that.trigger(EvType.Message, data);
    })
    this.socket.pipe(decoder)
    this.socket.once('connect', function() {
      that.trigger(EvType.Connect);
    });
    this.socket.once('close', function() {
      that.trigger(EvType.Disconnect);
    });
    this.socket.on('error', function(e) {
      that.trigger(EvType.Error, e);
      that.socket.destroy();
      that.socket = null;
    });
    return this.socket.connect(this.port, this.addr);
  };

  // send a message
  send (msg) {
		if (!this.socket){
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
    if (this.encoder) {
      this.encoder.end();
    }
    if (this.socket) {
      this.socket.destroy();
    }
    this.socket = null;
  }
}


const TcpTestServer = ({port, binary}) => {
  var conns = [];
  var server = net.createServer();
  server.on('connection', (conn)=>{
    conns.push(conn)
    if(!binary) {
      conn.setEncoding('utf8');
    }
    conn.on('data', (d)=>{
      conns.filter((c)=>{return c!==conn}).map((c)=>{c.write(d)})
    });
    conn.once('end', ()=>{
      conns = conns.filter((c)=>{return c!==conn})
      conn.destroy()
    });
    conn.on('error', (e)=>{
      conns = conns.filter((c)=>{return c!==conn})
      conn.destroy()
    });
  });
  server.listen(port, "127.0.0.1");
  return server
}

module.exports = {
  TcpTransport, TcpTestServer
}
