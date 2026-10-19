"""Builds the Roomba King's robot voice: every line it already says (the old speech-bubble lines in js/roomba.js), plus
its room-entry greetings and the punishment lines, spoken by a local Piper TTS voice (en_GB-alan-medium) and run
through a small robot filter (pitched up, ring-modulated, a metallic comb and a light bit-crush). All clips go into one
audio sprite: assets/audio/roomba_voice.mp3 + assets/audio/roomba_voice.json ({TEXT: [start s, dur s]}).
Usage: python3 tools/make_roomba_voice.py"""
import json, os, re, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.expanduser('~/piper_voices/en_GB-alan-medium.onnx')   # clearest on short words (tested with speech-to-text)
SR = 22050

def roomba_lines():
    s = open(os.environ.get('ROOMBA_JS', os.path.join(ROOT, 'js/roomba.js'))).read(); out = set()
    q = lambda t: [m.group(1).replace("\\'", "'") for m in re.finditer(r"'((?:[^'\\]|\\.)*)'", t)]
    for m in re.finditer(r'\b(?:say|boopFoot)\(', s):
        i = j = m.end(); depth = 1
        while depth and j < len(s): depth += {'(': 1, ')': -1}.get(s[j], 0); j += 1
        arg = s[i:j - 1]
        # dynamic obstacle lines ('THE ' + nm + ...) are generated below; keep only whole literal lines here
        out.update(t for t in q(arg) if not (t.endswith(' ') or t.startswith(' ')))
    for name in ('EAT', 'REPLIES', 'GREET', 'PUNISH_LINES'):
        m = re.search(name + r'\s*=\s*([\[{].*?[\]}]);', s)
        if m: out.update(t for t in q(m.group(1)) if t not in ('crumb', 'sock', 'note', 'cable', 'papers', 'cartridge'))
    # bump lines built from obstacle names (js/roomba.js: FIGHT ME, NAME / THE NAME STARTED IT / WHO PUT A NAME HERE)
    names = ['beanbag', 'bed', 'cushion', 'dresser', 'laundry', 'nightstand', 'shelf', 'cart shelf', 'record cabinet']
    for n in names:
        N = n.upper(); out.update(['FIGHT ME, ' + N, 'THE ' + N + ' STARTED IT', 'WHO PUT A ' + N + ' HERE'])
    return sorted(t for t in out if t.strip() and t not in ('wall', 'bed leg', 'foot', 'FIGHT ME,', 'THE', 'WHO PUT A'))

# how to say the odd ones out loud
SPOKEN = {
    '!!': 'Whoa!', '...': 'Hmmm.', '?': 'Huh?', 'AAAA': 'Aaaaah!', 'ZZZ': 'Zzzz. Zzzz.', 'ZZZ...CABLES...': 'Zzzz. Cables.',
    'PURR.EXE': 'Purr dot exe.', 'BUG 204: NOCLIP': 'Bug two oh four. No clip.', 'WALL: 1 ME: 0': 'Wall, one. Me, zero.',
    'BED LEG: 1 ME: 0': 'Bed leg, one. Me, zero.', 'BONK': 'Bonk. Ouch.', 'OH. FEET.': 'Oh. Those are feet.', 'EXCUSE ME. FOOT.': 'Excuse me. Your foot.', 'OOPS. SORRY. FEET.': 'Oops! Sorry, feet!',
    'FOOT IN THE WAY': 'Foot in the way!', 'GOING AROUND YOU': 'Going around you now.', 'WHAT ARE THOSE. FEET?': 'What are those? Are those feet?',
    "OH. YOU'RE BACK. ALL HAIL ME.": "Oh! You are back! All hail me, the king.", 'OW. BED.': 'Ow. Bed.', 'EPISODE 7: EATEN': 'Episode seven. Has been eaten.', 'ADOPTION PAPERS: EATEN': 'Adoption papers. Eaten.',
    'NOM': 'Nom nom nom.', 'NOM? (SHOELACE)': 'Nom? A shoelace?', 'BEEP.': 'Beep.', 'BEEP BOOP': 'Beep boop.', 'BOOP.': 'Boop.',
    'HMPH.': 'Hmph.', 'WHEEE': 'Wheee! Yay!', 'MINE': 'Mine. All mine.', 'THIEF': 'You thief!', 'ZOOMIES': 'Zoom zoom zoom!', 'SOCK ACQUIRED': 'One stinky sock, acquired.', 'RUDE.': 'How rude.',
    'OW. BED.': 'Ow! The bed.', 'OOH. SHINY.': 'Oooh. Something shiny.', 'STILL MAD': 'I am still mad.', 'MORE': 'More.', 'LA LA LA': 'La la la la.', 'NO PUSH TO MAIN': 'No push to main.',
    'SNIFF SNIFF': 'Sniff sniff.', 'OK BYE': 'Okay, bye.', 'OK I MISSED YOU': 'Okay. I missed you.', '...OK. HI.': 'Okay. Hi.',
    '...FINE.': 'Fine.', '...I WON.': 'I won.', 'INSPECTING...': 'Inspecting.', 'SCANNING FOR CABLES...': 'Scanning for cables.',
}
def spoken(t):
    if t in SPOKEN: return SPOKEN[t]
    s = t.lower(); s = re.sub(r'(^|[.!?]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), s)
    s = re.sub(r'\bi\b', 'I', s).replace("i'm", "I'm").replace('unity', 'Unity').replace('miles', 'Miles')
    return s if s[-1] in '.!?' else s + '.'

CACHE = os.path.expanduser('~/roomba_voice/cache')
def tts(text, path):
    import hashlib, shutil
    os.makedirs(CACHE, exist_ok=True); c = os.path.join(CACHE, hashlib.md5((os.path.basename(MODEL) + '|' + text).encode()).hexdigest() + '.wav')
    if os.path.exists(c): shutil.copy(c, path); return
    _tts(text, c); shutil.copy(c, path)
def _tts(text, path):
    subprocess.run(['piper', '-m', MODEL, '--output_file', path, '--length_scale', '1.0', '--sentence_silence', '0.12'],
                   input=text.encode(), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def small_room(x, sr):
    # synthetic small-room impulse: a few early reflections (walls 1-3 m away) and a short ~0.35 s decaying tail
    from scipy.signal import fftconvolve
    n = int(sr * 0.4); ir = np.zeros(n, np.float32); ir[0] = 1.0
    for ms, g in ((7, 0.32), (11, 0.26), (17, 0.2), (23, 0.16), (31, 0.12)): ir[int(sr * ms / 1000)] += g
    rng = np.random.default_rng(7); t = np.arange(n) / sr
    tail = rng.standard_normal(n).astype(np.float32) * np.exp(-t / 0.075) * 0.07; tail[:int(sr * 0.012)] = 0
    ir += tail
    y = fftconvolve(x, ir)[:len(x) + int(sr * 0.12)]
    return 0.78 * np.pad(x, (0, len(y) - len(x))) + 0.22 * y / (np.abs(ir).sum() ** 0.5)

def robot(x, sr):
    x = x.astype(np.float32); x /= (np.abs(x).max() + 1e-6)
    x = resample_poly(x, 100, 112)                     # pitched up ~2 semitones and a touch faster: small machine
    t = np.arange(len(x)) / sr
    y = x * (0.72 + 0.28 * np.sin(2 * np.pi * 48 * t))   # ring modulation: the robot wobble
    d = int(sr * 0.0045); c = y.copy(); c[d:] += 0.55 * y[:-d]   # short comb: tin-can metal
    hold = 2; c = np.repeat(c[::hold], hold)[:len(c)]    # light sample-hold crush (11 kHz grit)
    c = np.round(c * 48) / 48 * 0.35 + c * 0.65
    c = small_room(c, sr)                                # a little bedroom echo, so it sounds like it's in the room
    c /= (np.abs(c).max() + 1e-6); c *= 0.89
    f = int(sr * 0.008); c[:f] *= np.linspace(0, 1, f); c[-f:] *= np.linspace(1, 0, f)
    return c

def main():
    lines = roomba_lines(); print(len(lines), 'lines')
    tmp = tempfile.mkdtemp(); parts = []; idx = {}; pos = 0.0; gap = np.zeros(int(SR * 0.25), np.float32)
    for k, t in enumerate(lines):
        p = os.path.join(tmp, f'{k}.wav'); tts(spoken(t), p)
        sr, x = wavfile.read(p); assert sr == SR, sr
        if x.ndim > 1: x = x.mean(1)
        y = robot(x, SR)
        # trim leading/trailing near-silence
        nz = np.where(np.abs(y) > 0.01)[0]; y = y[max(0, nz[0] - 300): nz[-1] + int(SR * 0.15)] if len(nz) else y
        idx[t] = [round(pos, 3), round(len(y) / SR, 3)]; parts += [y, gap]; pos += (len(y) + len(gap)) / SR
    allw = np.concatenate(parts); wav = os.path.join(tmp, 'all.wav')
    wavfile.write(wav, SR, (allw * 32767).astype(np.int16))
    out = os.path.join(ROOT, 'assets/audio/roomba_voice.mp3')
    # CBR mp3 so sprite offsets are exact after decodeAudioData (decoder delay is trimmed by the LAME header)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '48k', out], check=True)
    json.dump({'v': 1, 'sr': SR, 'lines': idx, 'spoken': {t: spoken(t) for t in lines}}, open(os.path.join(ROOT, 'assets/audio/roomba_voice.json'), 'w'), indent=0)
    print('total', round(pos, 1), 's', os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    main()
