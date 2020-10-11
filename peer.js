
const EventEmitter = require('events');

class Peer {

  constructor(transport, whisper, reconnect){
    this.transport = transport
    this.whisper = whisper
    this.reconnect = reconnect
  }

  // on register an event listener.
  on (ev, handle, opts) {
     return this.whisper.on(ev, handle, opts);
  }

  // once register a listener that triggers once.
  once (ev, handle, opts) {
   return this.whisper.once(ev, handle, opts);
  }

  // off removes an event listener from an event.
  off (ev, handle, opts) {
    return this.whisper.off(ev, handle, opts);
  }

  connect(){
    var that = this;
    this.transport.on("connect", () => {
      that.whisper.connect(this.transport)
      that.whisper.trigger("connect");
      if (that.reconnect) {
        that.transport.once("reconnecting", ()=>{
          that.whisper.trigger("reconnecting");
        })
        that.transport.once("reconnect", ()=>{
          that.whisper.trigger("reconnect");
          that.connect()
        })
      }
    })
    return this.transport.connect()
  }

  disconnect(){
    this.transport.off("reconnect")
    this.transport.off("disconnect")
    this.transport.off("connect")
    this.transport.close()
    this.whisper.close()
    this.whisper.trigger("disconnect");
  }

  broadcast(){
    const args = Array.from(arguments);
    return this.whisper.broadcast.apply(this.whisper, args);
  }

  broadcastDirect(){
    const args = Array.from(arguments);
    return this.whisper.broadcastDirect.apply(this.whisper, args);
  }

  send(){
    const args = Array.from(arguments);
    return this.whisper.send.apply(this.whisper, args);
  }

  changeHandle(){
    const args = Array.from(arguments);
    return this.whisper.changeHandle.apply(this.whisper, args);
  }

}

module.exports = { Peer }
