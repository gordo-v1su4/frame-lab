import { createTimeSamplerState, reduceTimeSampler } from './vendor/reducer';
import {nextGrooveBeat} from './vendor/groove';
import type { TimeSamplerParams, TimeSamplerTransportSample } from './vendor/types';
export interface TriggerChannel {name:string;events:{time:number;strength:number;note?:number}[]}
export interface Grid { triggerChannels?:TriggerChannel[]; beats: number[]; duration: number; bpm: number; onsets?:{time:number;strength:number}[]; variedGroove?:boolean; groove?:Groove; stems?:{name:string;notes:{time:number;note:number;velocity:number;channel:number}[]}[] }
export interface Cut { id: number; at: number; source: number; pattern: string; stress: boolean; surprise: boolean; beat: number; triggerTime?:number; speed?:number; rampPeriod?:number; smashBeatSeconds?:number }
export type Groove='straight'|'swing'|'dotted'|'varied';
/** Groove feel for the nth trigger: fixed, or rotating straight/swing/dotted when varied. */
export const grooveFeel=(groove:Groove|undefined,n:number):0|1|2=>groove==='swing'?1:groove==='dotted'?2:groove==='varied'?(n%3) as 0|1|2:0;
export const patterns = ['midi-stems','cuts-only','audio-dense','audio-stutter4','mixed','straight','forward','backward','quarter','eighth','sixteenth','stutter2','stutter4','stutter8','dotted','swing','surprise','32nd','64th','speed-normal','speed-quarter','speed-third','speed-ramp','speed-smash'] as const;
export type Pattern = typeof patterns[number];
export function beatTime(grid: Grid, beat: number): number {
  const i = Math.floor(beat), f = beat-i;
  if (i < 0) return grid.beats[0] + beat * (grid.beats[1]-grid.beats[0]);
  if (i >= grid.beats.length-1) return grid.beats.at(-1)! + (beat-grid.beats.length+1)*60/grid.bpm;
  return grid.beats[i] + f*(grid.beats[i+1]-grid.beats[i]);
}
export function beatAt(grid: Grid, seconds: number): number {
  let lo=0, hi=grid.beats.length-1;
  while(lo<hi) { const mid=Math.ceil((lo+hi)/2); if(grid.beats[mid]<=seconds)lo=mid;else hi=mid-1; }
  const interval=(grid.beats[lo+1]??grid.beats[lo]+60/grid.bpm)-grid.beats[lo];
  return lo+(seconds-grid.beats[lo])/interval;
}
export function buildSchedule(grid: Grid, durations: number[], seed: number, seconds: number, selected: Pattern='mixed'): Cut[][] {
  if(grid.beats.length<2 || grid.beats.some((b,i)=>!Number.isFinite(b)||(i>0&&b<=grid.beats[i-1]))) throw new Error('Invalid beat grid');
  if(selected==='cuts-only')return durations.map((duration,deck)=>[{id:0,at:0,source:deck*duration/durations.length,pattern:selected,stress:false,surprise:false,beat:0}]);
  if((selected==='speed-ramp'||selected==='speed-smash')&&grid.triggerChannels?.length)return buildTriggeredRamps(grid,durations,seed,seconds,selected);
  if(selected.startsWith('speed-'))return durations.map((duration,deck)=>[{id:0,at:0,source:deck*duration/durations.length,pattern:selected,stress:false,surprise:false,beat:0,speed:selected==='speed-quarter'?.25:selected==='speed-third'?1/3:1,rampPeriod:selected==='speed-ramp'?2*60/grid.bpm:undefined,smashBeatSeconds:selected==='speed-smash'?60/grid.bpm:undefined}]);
  if(selected==='midi-stems'||grid.triggerChannels?.length)return buildMidiSchedule(grid,durations,seed,seconds,selected);
  if(selected==='audio-stutter4'||selected==='audio-dense')return buildAudioSchedule(grid,durations,seed,seconds,selected==='audio-dense');
  return durations.map((duration,deck)=>{
    const events: Cut[]=[];
    let rnd=(seed+deck*997)>>>0;
    const random=()=>{rnd=(Math.imul(rnd,1664525)+1013904223)>>>0;return rnd/4294967296;};
    if(selected==='straight')return [{id:0,at:0,source:deck*duration/durations.length,pattern:'straight',stress:false,surprise:false,beat:0}];
    for(let bar=0;beatTime(grid,bar*4)<seconds;bar++) {
      // Cycle guarantees coverage; seed varies order between decks and source selection.
      const choices: Pattern[]=['straight','forward','backward','quarter','eighth','sixteenth','stutter4','swing','dotted','stutter2','stutter8','surprise'];
      const pattern=selected==='mixed'?choices[(bar+deck*3+Math.abs(seed)%choices.length)%choices.length]:selected;
      const start=bar*4;
      const step=pattern==='straight'?4:pattern==='sixteenth'||pattern==='stutter8'?.25:pattern==='32nd'?.125:pattern==='64th'?.0625:pattern==='quarter'||pattern==='forward'||pattern==='backward'?1:.5;
      const stress=step<.25;
      const params:TimeSamplerParams={sourceDurationSeconds:duration,sliceCount:8,mode:pattern==='backward'?'REV':pattern==='forward'?'FWD':'RND',jumpSizeBeats:step,loopCount:pattern==='stutter4'?4:pattern==='stutter2'?2:pattern==='stutter8'?8:1,playbackRate:1,accentMode:'OFF',randomSeed:Math.floor(random()*0xffffffff),feel:pattern==='swing'?1:pattern==='dotted'?2:0};
      const sample=(beat:number):TimeSamplerTransportSample=>({transportSeconds:beatTime(grid,beat),audioOutputTimeSeconds:beatTime(grid,beat),performanceTimeSeconds:beatTime(grid,beat),playing:true,discontinuityGeneration:bar,beatPosition:beat,beatPhase:beat%1,beatIntervalSeconds:beatTime(grid,Math.floor(beat)+1)-beatTime(grid,Math.floor(beat)),presentationTimeSeconds:beatTime(grid,beat),transportSecondsAtBeat:b=>beatTime(grid,b)});
      let reduction=createTimeSamplerState(sample(start),params);
      // Offset starting slices to avoid every deck opening on frame zero.
      const offset=deck*duration/durations.length;
      let beat=start;
      while(beat<start+4-1e-7) {
        const at=Math.max(0,beatTime(grid,beat));
        if(at>=seconds)break;
        const source=stress?Math.floor(random()*8)*duration/8:reduction.output.sourceTimestampSeconds;
        events.push({id:events.length,at,source:(source+offset)%duration,pattern,stress,surprise:pattern==='surprise',beat});
        beat=stress?beat+step:reduction.nextState.nextBoundaryBeat;
        if(beat>=start+4-1e-7)break;
        reduction=reduceTimeSampler(reduction.nextState,sample(beat),[],params);
      }
    }
    if(!events.length||events[0].at>0)events.unshift({id:-1,at:0,source:0,pattern:'preroll',stress:false,surprise:false,beat:-1});
    return events.map((e,i)=>({...e,id:i}));
  });
}
export function strongOnsets(grid:Grid,dense=false){
  const selected:{time:number;strength:number}[]=[];
  for(const onset of grid.onsets??[]){
    if(onset.strength>=(dense?.45:.65)&&onset.time>=0&&Number.isFinite(onset.time)&&(!selected.length||onset.time-selected.at(-1)!.time>=(dense?.08:.12)))selected.push(onset);
  }
  return selected;
}
export function buildAudioSchedule(grid:Grid,durations:number[],seed:number,seconds:number,dense=false):Cut[][]{
  const triggers=strongOnsets(grid,dense);
  if(!triggers.length)throw new Error('Audio onset analysis is required; no random fallback');
  return durations.map((duration,deck)=>{
    let state=(seed+deck*997)>>>0,blockedUntil=-1;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const events:Cut[]=[{id:0,at:0,source:deck*duration/durations.length,pattern:'preroll',stress:false,surprise:false,beat:0}];
    let accepted=0;
    for(const [index,onset] of triggers.entries()){
      if(onset.time>=seconds)break;
      if(onset.time<blockedUntil||index%(dense?1:1+deck%3)!==0)continue;
      const source=Math.floor(random()*8)*duration/8;
      events.push({id:events.length,at:onset.time,source,pattern:'audio-onset',stress:false,surprise:false,beat:beatAt(grid,onset.time),triggerTime:onset.time});
      // Every fourth accepted onset starts a four-repeat burst. Deck phases differ.
      if(accepted++%(dense?2:4)===deck%(dense?2:4)){
        const step=dense?[1,.5,.25][(accepted+deck)%3]:deck%2?.25:.5;
        const feel:0|1|2=grid.groove&&grid.groove!=='varied'?grooveFeel(grid.groove,0):dense&&grid.variedGroove?(accepted+deck)%3 as 0|1|2:0;
        const repeats=dense?[2,4,8][(accepted+deck)%3]:4;
        // Give the onset at least two 60 Hz display opportunities before repeating.
        let beat=nextGrooveBeat(beatAt(grid,onset.time+1/30),step,feel);
        for(let repeat=0;repeat<repeats;repeat++){
          const at=beatTime(grid,beat);
          if(at>=seconds)break;
          events.push({id:events.length,at,source,pattern:`stutter${repeats}-${step===1?'quarter':step===.5?'eighth':'sixteenth'}-${['straight','swing','dotted'][feel]}`,stress:false,surprise:false,beat,triggerTime:onset.time});
          beat=nextGrooveBeat(beat+1e-7,step,feel);
        }
        blockedUntil=beatTime(grid,beat);
      }
    }
    return events;
  });
}
export function targetAt(events: Cut[], time:number, duration:number) {
  let lo=0,hi=events.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(events[mid].at<=time)lo=mid;else hi=mid-1;}
  const event=events[lo];
  const elapsed=Math.max(0,time-event.at);
  let travel=event.rampPeriod ? 1.25*elapsed-.75*event.rampPeriod/(2*Math.PI)*Math.sin(2*Math.PI*elapsed/event.rampPeriod) : elapsed*(event.speed??1);
  if(event.smashBeatSeconds){
    const b=elapsed/event.smashBeatSeconds,cycles=Math.floor(b/16),phase=b%16;
    travel=(cycles*10+Math.min(phase,12)*.25+Math.min(Math.max(phase-12,0),1)*4+Math.max(phase-13,0))*event.smashBeatSeconds;
  }
  let rate=event.speed??1;
  if(event.rampPeriod)rate=1.25-.75*Math.cos(2*Math.PI*elapsed/event.rampPeriod);
  if(event.smashBeatSeconds){const phase=(elapsed/event.smashBeatSeconds)%16;rate=phase<12?.25:phase<13?4:1;}
  return { event, source:((event.source+travel)%duration+duration)%duration,rate };
}

export function buildMidiSchedule(grid:Grid,durations:number[],seed:number,seconds:number,selected:Pattern='midi-stems'):Cut[][] {
  const channels=grid.triggerChannels??grid.stems?.map(stem=>({name:stem.name,events:stem.notes.map(n=>({time:n.time,note:n.note,strength:n.velocity/127}))}));
  if(!channels?.length)throw new Error('MIDI stem events are required');
  return durations.map((duration,deck)=>{
    const stem=channels[deck%channels.length];
    const step=selected==='quarter'?1:selected==='eighth'?.5:selected==='sixteenth'?.25:stem.name==='synth'?.25:stem.name==='bass'?1:.5;
    const repeats=selected==='stutter2'?2:selected==='stutter8'?8:4;
    let state=(seed+deck*997)>>>0,blockedUntil=0,triggers=0;
    const events:Cut[]=[{id:0,at:0,source:deck*duration/durations.length,pattern:stem.name+'-preroll',stress:false,surprise:false,beat:0}];
    for(const note of stem.events){
      if(note.time>=seconds)break;
      if(note.time<blockedUntil||note.strength<=0)continue;
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      const source=Math.floor(state/4294967296*8)*duration/8;
      const startBeat=beatAt(grid,note.time);
      const feel=grooveFeel(grid.groove,deck+triggers++);
      const feelName=feel?'-'+['straight','swing','dotted'][feel]:'';
      // Four plays of the same anchor, beginning exactly at the note-on; later
      // repeats land on the groove grid. Chords and notes inside a burst coalesce.
      let beat=startBeat;
      for(let repeat=0;repeat<repeats;repeat++){
        const at=beatTime(grid,beat);
        if(at>=seconds)break;
        events.push({id:events.length,at,source,pattern:stem.name+'-stutter'+repeats+'-'+(step===1?'quarter':step===.5?'eighth':'sixteenth')+feelName+(note.note===undefined?'':'-note'+note.note),stress:false,surprise:false,beat,triggerTime:note.time});
        beat=feel?nextGrooveBeat(beat+1e-7,step,feel):beat+step;
      }
      blockedUntil=beatTime(grid,beat);
    }
    return events;
  });
}

function buildTriggeredRamps(grid:Grid,durations:number[],seed:number,seconds:number,pattern:Pattern):Cut[][]{
  return durations.map((duration,deck)=>{
    const channel=grid.triggerChannels![deck%grid.triggerChannels!.length];
    const events:Cut[]=[{id:0,at:0,source:deck*duration/durations.length,pattern:'speed-normal',stress:false,surprise:false,beat:0,speed:1}];
    let state=(seed+deck*997)>>>0,blockedUntil=0;
    for(const trigger of channel.events){
      if(trigger.time>=seconds)break;
      if(trigger.time<blockedUntil)continue;
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      if(state/4294967296>.4)continue;
      const at=trigger.time,source=targetAt(events,at,duration).source;
      const period=2*60/grid.bpm,smashBeat=60/grid.bpm;
      const stop=at+(pattern==='speed-ramp'?period:16*smashBeat);
      events.push({id:events.length,at,source,pattern,stress:false,surprise:false,beat:beatAt(grid,at),triggerTime:at,rampPeriod:pattern==='speed-ramp'?period:undefined,smashBeatSeconds:pattern==='speed-smash'?smashBeat:undefined});
      if(stop<seconds)events.push({id:events.length,at:stop,source:targetAt(events,stop,duration).source,pattern:'speed-normal',stress:false,surprise:false,beat:beatAt(grid,stop),speed:1});
      blockedUntil=stop+.12;
    }
    return events;
  });
}
