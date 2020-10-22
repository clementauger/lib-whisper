
const ndjson = require('ndjson')
var msgpack = require('msgpack5')()

const Json = {
  encode: (d)=>{return JSON.stringify(d)+"\n"},
  decode: JSON.parse,
  encoder: ndjson.stringify,
  decoder: ndjson.parse,
  binary: false,
};
const MsgPack = {
  encode: msgpack.encode,
  decode: msgpack.decode,
  decoder: ()=>{return msgpack.decoder({wrap:!true})},
  encoder: ()=>{return msgpack.encoder({wrap:!true})},
  binary: true,
};

module.exports = { Json, MsgPack }
