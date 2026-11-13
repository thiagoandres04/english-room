export const MAX_AUDIO_BYTES=25*1024*1024;
export const MAX_AUDIO_TRACKS=5;
export type ListeningTrack={id:string;title:string;name:string;size:number};
export function sniffAudio(bytes:Uint8Array):string|null{
 const text=(start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));
 if(text(0,3)==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0))return 'audio/mpeg';
 if(text(0,4)==='RIFF'&&text(8,4)==='WAVE')return 'audio/wav';
 if(text(4,4)==='ftyp')return 'audio/mp4';
 if(text(0,4)==='OggS')return 'audio/ogg';
 if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return 'audio/webm';
 return null;
}
/** One HTTP byte range is enough for native audio seeking, including Safari. */
export function parseAudioRange(header:string|null,size:number):{offset:number;length:number}|null{
 if(!header)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(header.trim());
 if(!match||(!match[1]&&!match[2]))throw new Error('Invalid range');
 let start:number,end:number;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw new Error('Invalid range');start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Math.min(size-1,Number(match[2])):size-1;}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw new Error('Invalid range');
 return {offset:start,length:end-start+1};
}
