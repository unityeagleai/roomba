# Roomba VR creature build (Charlie) - started Sat Oct 17 2026 ~22:25 UTC
Repo dir: /home/sprite/roomba-vr  -> publish as unityeagleai/roomba (GitHub Pages)
Look (from charlie-season + basement): grey/silver disc, dark centre, green LED, GOLD CROWN with red jewel ("ROOMBA KING"), magenta when eating.
Lines: BEEP. / ALL HAIL ME / I ATE A CABLE / NO PUSH TO MAIN / CRUMBS DETECTED / new human detected. scanning for cables. / lawyer is also the Roomba
Room: 80s bedroom palette from charlie-season/tools/draw_room.py. Posters cropped to assets/img.
Theme: assets/audio/roomba_theme_chip.mp3 (12 s chiptune of The Roomba Ran Away, from basement html)
Controls copied from between-signals/site/js/app.js (readXR, enterVR).
- [x] assets
- [x] code
- [x] tested (desktop chromium, swiftshader)
- [x] published https://unityeagleai.github.io/roomba/

## Media update (cartridges, CRT, big screen, record player) - run of Sun Oct 18 2026
- [x] js/media.js already written by earlier runs (shelf, 7 carts, console slot, CRT video, big screen, record player, Xanadu poster)
- [x] wired: index.html loads js/media.js (+ #bBig / #bRec HTML buttons); app.js routes XR selectstart/selectend, desktop click, frame tick, unlock, reticle hover to RV.media; RV.ensureAudio exposed
- [x] record audio now positional (HRTF PannerNode at the deck, RP_POS); file assets/audio/xanadu_story.m4a is already the 0:00.3-4:11.3 clip (251.0 s)
- [x] desktop test PASSED (tools/test_media.py, Chromium swiftshader 960x540): poster loads (512x758); all 7 carts click->console->play on CRT (1280 wide, time advancing, no media errors); 3D BIG SCREEN + 3D BACK TO TV + HTML button + F/Esc all toggle; VR selectstart/selectend logic with stand-in controller inserts cart; record plays 251 s clip via HTML panner at deck, pauses episode, stops; Roomba states change (dock, undock, notice, follow, circle, keepAway, wander, eat, bump); 0 console errors. Fixed: HUD was covering the 3D BACK TO TV button (now max-width 44%, pointer-events none).
- [x] published commit a3e3c60 to unityeagleai/roomba; Pages build "built"; live page loads js/media.js; live smoke test: ep 7 plays from charlie-season, record plays (251 s, panner), 0 errors.
- [ ] NOT tried on a real Quest yet (trigger grab/release, big screen placement in VR, positional record sound in headset).

## Wall big screen - run of Sun Oct 18 2026 (Unity tested on Quest 3: carts + big screen work, floating screen clipped into a wall)
- [x] big screen now projects on the front wall exactly across from the TV (x = TV.sx 0.66, z = RZ-0.04, facing -Z, scale 1.15 -> picture 2.76 m wide), between the door frame (x -0.915) and the right wall; clear of picture rail + skirting; depth tested
- [x] 'look behind you' cue floats ~1.15 m in front of the head when the screen is behind you (>75 deg); hides when you turn to it (<40 deg), after 9 s, or on close
- [x] video sound panner moves to the wall screen
- [x] desktop FULL SCREEN button / F keep the old fill-the-view mode
- [x] tools/test_wall.py PASSED locally + old test_media.py (all 7 carts, record, Roomba) still pass

## Z-fighting fix - run of Sun Oct 18 2026 (Unity's phone screenshot: wood flickering through the bedspread at the foot end)
- [x] cause: the quilt box ended exactly on the footboard's outer face (x = X1) -> same plane, wood/blanket flicker; side rails also ran through head/footboard (shared faces)
- [x] bed: quilt overhangs 3 cm past the frame on both sides and the foot end (QOV), quilt material polygonOffset (-1,-2) as extra; side rails now run headboard->footboard only
- [x] tools/find_coplanar.py: scans every mesh (use ?nomerge, new debug flag that skips the static merges) for same-facing overlapping triangles within EPS. Fixed all visible 0 mm hits:
  bookshelf (sides under top board, boards between sides, back panel tucked in), VHS leaning tape (4 mm back), figurine plinth rim (open band, caps were on the disc top),
  console brass trims (0.564 wide), cart shelf + record cabinet back panels tucked in, leaning records out 3 mm, skirting/picture rail corners, dock base plate, zombie plush hair cap, record lid label, socks, crumbs
- [x] camera near 0.03 -> 0.05 (finer depth everywhere)
- [x] remaining scanner hits are invisible: undersides on the deck, Roomba bristles/glow under the body, transparent blob shadows (no depth write), hidden controller tips/reticle
- [x] green figure on the bed = the zombie plush (built on the bed on purpose in room.js); Unity Eagle figurine is on the bookshelf middle board (y 1.2125)
- [x] tests: tools/test_bed.py close-ups, test_wall.py + test_media.py (with ?eps=charlie-season) + test_figurine.py all pass, 0 errors
