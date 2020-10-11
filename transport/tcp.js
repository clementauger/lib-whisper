const net = require('net');
const EventEmitter = require('events');
const ndjson = require('ndjson')

const { Err } = require('./errors');
const { EvType } = require('./events.type');

class TcpTransport {
  constructor (port, addr, reconnectTimeout) {
    this.events = new EventEmitter();
    this.reconnectTimeout = reconnectTimeout;
    this.reconnectHandle = null;
    this.socket = null;
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
  connect () {
    if (this.socket!=null){
      this.close();
    }
    var that = this;
    this.socket = new net.Socket();
    // this.socket.setNoDelay(true);
    this.socket.setEncoding('utf8');
    // this.socket.on('data', function(data) {
    //   that.trigger(EvType.Message, data);
    // });
    this.socket.pipe(ndjson.parse()).on("data", function(data) {
      that.trigger(EvType.Message, data);
    })
    this.socket.on('connect', function() {
      that.trigger(EvType.Connect);
    });
    this.socket.on('close', function() {
      that.trigger(EvType.Disconnect);
      if (that.reconnectTimeout>0){
        that.trigger(EvType.Reconnecting, that.reconnectTimeout);
        clearTimeout(that.reconnectHandle)
        that.reconnectHandle = setTimeout(that.reconnect.bind(that), that.reconnectTimeout);
      }
    });
    this.socket.on('error', function(e) {
      that.trigger(EvType.Error, e);
      that.socket.destroy();
      that.socket = null;
    });
    this.socket.connect(this.port, this.addr);
    return this
  };

  // send a message
  send (msg) {
		if (!this.socket)
      return Err.SocketClosed;

		try {
			this.socket.write(JSON.stringify(msg)+"\n");
		} catch (e) {
      return e
		};
    return null;
  }

  reconnect () {
    clearTimeout(this.reconnectHandle);
    this.trigger(EvType.Reconnect, this.reconnectTimeout);
		this.connect(this.port, this.addr);
  }

  close () {
    this.socket.destroy();
    this.socket = null;
  }
}


const TcpTestServer = (port) => {
  var conns = [];
  var server = net.createServer();
  server.on('connection', (conn)=>{
    conns.push(conn)
    // conn.setNoDelay(true);
    conn.setEncoding('utf8');
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
