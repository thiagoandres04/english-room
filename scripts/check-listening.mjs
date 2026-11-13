import assert from 'node:assert/strict';
import {parseAudioRange,sniffAudio} from '../lib/listening.ts';
assert.deepEqual(parseAudioRange('bytes=0-19',100),{offset:0,length:20});assert.deepEqual(parseAudioRange('bytes=40-',100),{offset:40,length:60});assert.deepEqual(parseAudioRange('bytes=-10',100),{offset:90,length:10});assert.deepEqual(parseAudioRange('bytes=90-300',100),{offset:90,length:10});assert.equal(parseAudioRange(null,100),null);
for(const range of ['bytes=100-','bytes=5-2','bytes=-0','bytes=0-2,5-9','not a range'])assert.throws(()=>parseAudioRange(range,100));
assert.equal(sniffAudio(Buffer.from('RIFF0000WAVE')), 'audio/wav');assert.equal(sniffAudio(Buffer.from('ID3abc')), 'audio/mpeg');assert.equal(sniffAudio(Buffer.from('OggSabc')), 'audio/ogg');assert.equal(sniffAudio(Buffer.from('HTML document')),null);
console.log('PASS: formatos de audio y rangos HTTP válidos, sufijos, límites y rangos inválidos.');
