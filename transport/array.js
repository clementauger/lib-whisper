const EventEmitter = require('events');

const { Err } = require('./errors');
const { EvType } = require('./events.type');

class ArrayTransportProvider {
  constructor (readInterval) {
    this.readInterval = readInterval || 1000;
    this.msgID = 0;
    this.msgs = [];
    this.endpoints = [];
  }
  endPoint () {
    const id = this.endpoints.length;
    const ep = new ArrayTransport(this, this.readInterval, id);
    this.endpoints.push(ep)
    return ep
  }
  publish (from, msg) {
    const msgID = this.msgID++;
    this.msgs.push({id:msgID, from: from, data: msg})
    if (this.msgs.length>500) {
      this.msgs.slice(500, this.msgs.length-500)
    }
  }
  read (from, since) {
    return this.msgs.filter( (m) => {
      return m.from != from;
    }).filter( (m)=> {
      return m.id>since;
    })
  }
}

class ArrayTransport {
  constructor (arrayTransport, readInterval, id) {
    this.id = id;
    this.transport = arrayTransport;
    this.readInterval = readInterval || 1000;
    this.readHandle = null;
    this.lastMsgID = -1;
    this.events = new EventEmitter();
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


  // connect the transport.
  connect () {
    var that = this;
    clearInterval(this.readHandle);
    this.readHandle = setInterval( this.read.bind(this), this.readInterval)
    this.trigger(EvType.Connect);
    return this
  };

  read () {
    const msgs = this.transport.read(this.id, this.lastMsgID)
    if (msgs.length){
      this.lastMsgID = msgs[msgs.length-1].id;
      msgs.map( (m) => {
        try{
          this.trigger(EvType.Message, JSON.parse(m.data));
        }catch(e){console.error(e)}
      })
    }
  };

  // send a message
  send (msg) {
    msg = JSON.stringify(msg);
    this.transport.publish(this.id, msg)
    return null;
  }

  reconnect () {
    clearTimeout(this.reconnectHandle);
    this.trigger(EvType.Reconnect, this.reconnectTimeout);
		this.connect();
  }

  close () {
    clearInterval(this.readHandle);
    this.trigger(EvType.Disconnect);
    if (this.reconnectTimeout>0){
      this.trigger(EvType.Reconnecting, this.reconnectTimeout);
      clearTimeout(this.reconnectHandle)
      this.reconnectHandle = setTimeout(this.reconnect.bind(this), that.reconnectTimeout);
    }
  }
}

module.exports = {
  ArrayTransportProvider, ArrayTransport
}
