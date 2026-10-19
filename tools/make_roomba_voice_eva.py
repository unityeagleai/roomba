"""Builds the Roomba King's voice from Unity's own ElevenLabs recording: every line read by "Eva - Futuristic Robot Helper"
(Eleven v4), all 152 lines in one file, in the same (sorted) order as the keys of assets/audio/roomba_voice.json.
Where each line starts and ends is in tools/roomba_voice_eva_cuts.json (found by cutting on every pause >= 0.3 s,
running speech-to-text on every piece and grouping the pieces to the lines; two cuts were set by hand: 'feet! | Ow!' and
the three snoring lines at the end). Each clip is trimmed, evened out in loudness and given a light small-room echo
(no robot filter: she already sounds like a robot, and stays recognisable). Written as one audio sprite:
assets/audio/roomba_voice.mp3 + .json ({TEXT: [start s, dur s]}, same keys as before, so js/roomba.js needs no new names).
Every clip was checked with speech-to-text (faster-whisper small.en) against the line it's mapped to.
Usage: python3 tools/make_roomba_voice_eva.py [path/to/eva_recording.mp3]"""
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_roomba_voice import small_room   # the same synthetic bedroom echo
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/eva_clips/eva_all.mp3')
SR = 32000
JSON = os.path.join(ROOT, 'assets/audio/roomba_voice.json')

def main():
    old = json.load(open(JSON)); keys = sorted(old['lines']); spoken = old['spoken']
    tmp = tempfile.mkdtemp(); wav = os.path.join(tmp, 'src.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', SRC, '-ac', '1', '-ar', str(SR), wav], check=True)
    sr, x = wavfile.read(wav); x = x.astype(np.float32) / 32768
    cuts = json.load(open(os.path.join(ROOT, 'tools/roomba_voice_eva_cuts.json')))['cuts']
    assert sorted(cuts) == keys, 'cut list and voice lines differ'
    clips = []
    for k, key in enumerate(keys):
        t0, t1 = cuts[key]
        y = x[int(t0 * sr): int(t1 * sr)].copy()
        nz = np.where(np.abs(y) > 0.015)[0]
        if len(nz): y = y[max(0, nz[0] - int(sr * 0.03)): min(len(y), nz[-1] + int(sr * 0.12))].copy()
        # even out loudness: the loudest 20% of 20 ms frames to the same level (quiet lines like 'Okay. Hi.' come up)
        f = int(sr * 0.02); fr = y[:len(y) // f * f].reshape(-1, f); r = np.sqrt((fr ** 2).mean(1))
        top = np.sort(r)[-max(1, len(r) // 5):].mean() if len(r) else 0.1
        y *= min(3.0, 0.16 / max(top, 1e-4))
        clips.append(y)
        if os.environ.get('DUMP'):   # DUMP=dir: also write each trimmed clip (for the speech-to-text check)
            os.makedirs(os.environ['DUMP'], exist_ok=True); wavfile.write(os.path.join(os.environ['DUMP'], '%03d.wav' % k), sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
    out = []; idx = {}; pos = 0.0; gap = np.zeros(int(SR * 0.25), np.float32)
    peak = max(np.abs(small_room(c, SR)).max() for c in clips)
    for key, y in zip(keys, clips):
        z = small_room(y, SR) / peak * 0.89
        nz = np.where(np.abs(z) > 0.004)[0]; z = z[: nz[-1] + int(SR * 0.05)] if len(nz) else z
        fd = int(SR * 0.006); z[:fd] *= np.linspace(0, 1, fd); z[-fd:] *= np.linspace(1, 0, fd)
        idx[key] = [round(pos, 3), round(len(z) / SR, 3)]; out += [z.astype(np.float32), gap]; pos += (len(z) + len(gap)) / SR
    allw = np.concatenate(out); w2 = os.path.join(tmp, 'all.wav')
    wavfile.write(w2, SR, (np.clip(allw, -1, 1) * 32767).astype(np.int16))
    mp3 = os.path.join(ROOT, 'assets/audio/roomba_voice.mp3')
    # CBR mp3 so sprite offsets are exact after decodeAudioData (decoder delay is trimmed by the LAME header)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w2, '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '64k', mp3], check=True)
    json.dump({'v': 2, 'sr': SR, 'voice': 'ElevenLabs Eva - Futuristic Robot Helper (Eleven v4), recorded by Unity', 'lines': idx, 'spoken': {k: spoken[k] for k in keys}},
              open(JSON, 'w'), indent=0)
    print(len(idx), 'lines, total', round(pos, 1), 's', os.path.getsize(mp3), 'bytes')

if __name__ == '__main__':
    main()
