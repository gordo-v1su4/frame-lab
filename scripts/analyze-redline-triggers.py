# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["librosa==0.11.0", "soundfile==0.13.1"]
# ///
"""Prepare reproducible Redline spectral-flux and RMS events; no runtime FFT."""
import hashlib, json
from pathlib import Path
import librosa
import numpy as np
root=Path(__file__).resolve().parents[1]
out=root/'prep/fixtures/test-media/benchmark'
stems=root.parent/'beatsmaxxer-pro/test_media/Redline (Remastered) Stems'
midi=json.loads((out/'redline-midi.json').read_text())
features={}
for name in ['mix','vocals','synth','bass','drums']:
    path=out/'redline.mp3' if name=='mix' else stems/f'Redline (Remastered) ({name.title()}).wav'
    print(f'Analyzing {name}',flush=True)
    y,sr=librosa.load(path,sr=22050,mono=True);hop=220
    flux=librosa.onset.onset_strength(y=y,sr=sr,hop_length=hop)
    frames=librosa.onset.onset_detect(onset_envelope=flux,sr=sr,hop_length=hop,units='frames')
    scale=max(float(np.percentile(flux[frames],95)),1e-9) if len(frames) else 1
    onsets=[{'time':float(f*hop/sr),'strength':min(1.,float(flux[f])/scale)} for f in frames]
    rms=librosa.feature.rms(y=y,frame_length=1024,hop_length=hop)[0]
    normalized=rms/max(float(np.percentile(rms,95)),1e-9)
    # Smooth 50ms envelope, then rising threshold with hysteresis (not LUFS).
    smooth=np.convolve(normalized,np.ones(5)/5,mode='same')
    activity=[];active=False;last=-1.
    for i,value in enumerate(smooth):
        t=i*hop/sr
        if not active and value>=.2 and t-last>=.25:
            activity.append({'time':t,'strength':min(1.,float(value))});active=True;last=t
        elif value<.1:active=False
    peaks=librosa.util.peak_pick(smooth,pre_max=10,post_max=10,pre_avg=20,post_avg=20,delta=.08,wait=15)
    loudness=[{'time':float(i*hop/sr),'strength':min(1.,float(smooth[i]))} for i in peaks if smooth[i]>=.25]
    bands={}
    if name=='mix':
        # FFT band split: spectral flux per mel band group (kick / body+vocal / hats+air).
        mel=librosa.power_to_db(librosa.feature.melspectrogram(y=y,sr=sr,hop_length=hop,n_mels=64,fmax=11025))
        freqs=librosa.mel_frequencies(n_mels=64,fmax=11025)
        for band,(lo,hi) in {'low':(0,150),'mid':(150,2000),'high':(2000,11025)}.items():
            rows=(freqs>=lo)&(freqs<hi)
            env=librosa.onset.onset_strength(S=mel[rows],sr=sr,hop_length=hop)
            bf=librosa.onset.onset_detect(onset_envelope=env,sr=sr,hop_length=hop,units='frames')
            bs=max(float(np.percentile(env[bf],95)),1e-9) if len(bf) else 1
            bands[band]=[{'time':float(f*hop/sr),'strength':min(1.,float(env[f])/bs)} for f in bf]
            print(f'mix {band} band: {len(bands[band])} onsets',flush=True)
    features[name]={'bands':bands,'sourceFile':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'duration':len(y)/sr,'onsets':onsets,'activity':activity,'loudness':loudness,'envelope':{'intervalSeconds':hop/sr*5,'values':[round(float(v),4) for v in smooth[::5]]}}
    print(f'{name}: {len(onsets)} onsets, {len(activity)} activity starts, {len(loudness)} RMS peaks',flush=True)
json.dump({'version':1,'sourceUrl':midi['sourceUrl'],'sourceSha256':midi['sourceSha256'],'duration':midi['duration'],'bpm':midi['bpm'],'beats':midi['beats'],'features':features,'analysis':{'library':'librosa 0.11.0','sampleRate':22050,'hop':220,'onsets':'FFT-derived positive spectral flux with peak picking','bands':'mix only: spectral flux over 64-band mel split into low <150 Hz, mid 150-2000 Hz, high >2000 Hz','loudness':'50ms-smoothed RMS peaks, relative amplitude; not perceptual LUFS','activity':'RMS rising gate at .2 of p95 with .1 release and 250ms refractory','alignment':'same Redline export folder; full-mix hash verified; no manually applied alignment offset','beatGrid':'MIDI tempo map used only for subdivisions; triggers come from audio analysis'}},(out/'redline-analysis.json').open('w'),indent=2)
