const EventEmitter = require('events');
const WebSocket = require('isomorphic-ws');
const Codec = require("./codec")

const { Err } = require('./errors');
const { EvType } = require('./events.type');

class WsTransport {
  constructor ({
    url = "",
    codec = Codec.Json,
    reconnectTimeout = 0,
  }) {
    this.events = new EventEmitter();
    this.reconnectTimeout = reconnectTimeout;
    this.reconnectHandle = null;
    this.url = url;
    this.codec = codec;
    this.ws = null;
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
    if (this.ws!=null){
      this.close();
    }
    this.ws = new WebSocket(this.url);

    var that = this;
    this.ws.onopen = () => {
      that.trigger(EvType.Connect);
    };
    this.ws.onmessage = (m) => {
      try{
        const d = that.codec.decode(m.data)
        that.trigger(EvType.Message, d);
      }catch(e){
        console.error(e)
        that.trigger("error", e)
      }
    };
    this.ws.onerror = (e) => {
      that.trigger(EvType.Error, e);
      that.ws.close();
      that.ws = null;
    };
    this.ws.onclose = (e) => {
      if (e.code == 1000) {
        if (e.reason && MsgType.hasOwnProperty(e.reason)) {
          that.trigger(EvType.Disconnect, e.reason);
          return
        }
      } else if (e.code != 1005) {
        if (that.reconnectTimeout>0){
          that.trigger(EvType.Reconnecting, that.reconnectTimeout);
          clearTimeout(that.reconnectHandle)
          that.reconnectHandle = setTimeout(that.reconnect.bind(that), that.reconnectTimeout);
        }
      }else{
        that.trigger(EvType.Disconnect, e);
      }
    };
    return this
  }

  // send a message
  send (msg) {
		if (!this.ws || this.ws.readyState == WebSocket.CLOSED || this.ws.readyState == WebSocket.CLOSING)
      return Err.SocketClosed;
    if(msg===undefined){throw "e";return}
    try{
      const d = this.codec.encode(msg)
      this.ws.send(d);
    }catch(e){
      console.error(e)
      this.trigger("error", e)
    }

		// try {
		// 	if (typeof (msg) == "object") {
		// 		msg = JSON.stringify(msg);
		// 	}
		// 	this.ws.send(msg);
		// } catch (e) {
    //   return e
		// };
    return null;
  }

  reconnect () {
    clearTimeout(this.reconnectHandle);
    this.trigger(EvType.Reconnect, this.reconnectTimeout);
		this.connect(this.url);
  }

  close () {
    this.ws.close();
  }
}

const WsTestServer = (port) => {
  const server = new WebSocket.Server({ port: port, noServer: true });
  server.on('connection', (conn)=>{
    conn.on('message', (d)=>{
      server.clients.forEach(function each(client) {
        if (client !== conn && client.readyState === WebSocket.OPEN) {
          client.send(d);
        }
      });
    });
  });
  return server
}

module.exports = {
  WsTransport, WsTestServer
}
