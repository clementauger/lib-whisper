const EventEmitter = require('events');

class Peer {

  constructor(whisper, reconnect){
    this.whisper = whisper
    this.reconnect = reconnect

    this.connect=this.connect.bind(this);
    this.onConnect=this.onConnect.bind(this);
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

  async connect(){
    const transport = this.whisper.transport;
    if (this.reconnect) {
      this.whisper.once("connect", this.onConnect)
    }
    return await this.whisper.connect()
  }

  async onConnect(){
    if (this.reconnect) {
      this.whisper.once("reconnect", this.connect)
    }
  }

  async disconnect(){
    this.whisper.off("connect", this.onConnect)
    this.whisper.off("reconnect", this.connect)
    return await this.whisper.close()
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
