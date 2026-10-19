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

## Xanadu memory mirror - run of Sun Oct 18 2026 (Unity asked on the call for a mirror / memory of her nine-year-old self singing into a hairbrush)
- [x] assets/img/memory_xanadu_age9.jpg = Unity's own image from chat (1189x1536), only scaled to 793x1024 JPEG q86 (~100 KB), text overlay kept
- [x] js/mirror.js: right wall (x = RX), centre z 0.74, y 1.47, picture 0.60 x 0.775 m in a plum rounded frame with a pink neon tube just outside the picture (covers none of it) + additive neon glow on the wallpaper; 5 draw calls, no extra lights
- [x] glow + neon breathe brighter while the record plays (reads RV.media._debug.rp.on in tube.onBeforeRender; media.js untouched)
- [x] tools/test_mirror.py PASSED (texture 793x1024, aspect kept, clear of liminal poster / fairy lights / corner / rail / skirting, unoccluded 5/5 rays from 5 spots, glow 0.5 -> ~0.9 while playing, back after stop, 0 console errors); test_media, test_wall, test_figurine still pass
- [ ] NOT seen in a headset yet

## Zombie jump scare - run of Sun Oct 18 2026 (Unity on the call: 'you trigger it, and you think it doesn't do anything, and then it jumps you')
- [x] room.js: zombie plush group named 'zombiePlush', meshes userData.dynamic (skipped by the static merge), parts exposed as RV.zombiePlush (looks identical at rest)
- [x] js/zombie.js: trigger at it (VR selectstart, 0.2 m hit sphere) or click it on screen -> NOTHING for a random 2.6-4.2 s -> leaps (0.3 s arc) to 0.8 m in front of wherever you look now, scales 2.4x (~67 cm), turns to face you, red eyes, open mouth, arms reach out, HRTF growl + hiss + 8-bit shriek from where it lands, controller haptics; holds 1.5 s (jitters itself, never moves closer), hops back to exactly its spot (0.75 s), 3 s cooldown
- [x] comfort: camera/rig never touched; never closer than 0.5 m to the eyes (nose to a wall/furniture it swerves up to ~80 deg to the side, and comes in smaller); one scare at a time (triggers while armed / mid-scare / cooling are swallowed); Roomba startles too (R.hear('loud'))
- [x] app.js hooks: XR selectstart (after media), desktop click (after media), reticle ray length, frame tick, __rv.zombie() debug
- [x] RV.zombie.trigger({delay}) is public, so the multiplayer task can sync a scare to both players later
- [x] tools/test_zombie.py (desktop, swiftshader)
- [ ] NOT tried in a headset yet

## Stuck after the zombie scare - run of Sun Oct 18 2026 (Unity in the Quest 3: 'after it jump scared me I'm no longer able to move around, almost like being stuck at the wall')
- [x] cause: not zombie.js (it never touches the rig, camera or colliders). app.js move() refused any step whose destination was blocked, tested at the REAL head position (rig + headset tracking). When Unity flinched back from the zombie in real life, her head went inside the 20 cm wall/furniture comfort zone; from inside it every thumbstick step (out, along, in) still landed 'blocked', so all movement was refused forever = invisible wall
- [x] fix (app.js): pen(x, z) = how deep you are in walls/Unity-blocking furniture; okStep() allows a step if it lands free OR if you're already inside and it doesn't take you deeper. So you can always walk out or slide along, never further in. Free-floor behaviour unchanged; zombie.js unchanged
- [x] test hooks: __rv.fakeXR(session) (stand-in XR session with fake gamepads through the real readXR path), __rv.pen(), __rv.P()
- [x] tools/test_zombie.py section 4: fake thumbsticks move fwd/back/left/right + snap-turn before a scare, after 3 scares in a row (snap-turning away during each wait), during the scare, straight through each landing spot; flinch 40 cm back into the right wall during a scare -> never pushed deeper, slides along, walks out; all directions after
- [ ] NOT tried in a headset yet

## Unity Eagle origin video frame - run of Sun Oct 18 2026 (Unity on the call: the origin story film, her song version, in a digital photo frame, click to play)
- [x] source: her Drive video (1280x720 HEVC, 3:33 incl. song) -> assets/video/unity_eagle_origin.mp4, H.264 High@4.0 720p30 CRF 23 (max 1.8 Mbps) + AAC 128k stereo, faststart, full length (213.1 s), 48 MB
- [x] assets/img/unity_eagle_origin_still.jpg = frame at 12 s (1024x576), shown until clicked
- [x] js/originframe.js: black photo frame (screen 34 x 19 cm) standing on the dresser top right of the CRT (x 1.10..1.48, z -2.07..-1.89), next to the bookshelf with the figurine + VHS tapes; turned a little to the room, leaning back on a kickstand
- [x] click / trigger: play; again: pause (frame held); again: carry on; end -> back to the still. preload=metadata, never autoplays. HRTF panner at the frame. Starting it pauses an episode, lifts the needle, stops the keycard poster; any of those starting pauses it. Hooks RV.media like videoposter.js
- [x] tools/test_originframe.py (needs a Range-capable server for the end check), all old tests rerun: bed, wall, media, figurine, mirror, videoposter, zombie, socials, 0 errors; find_coplanar: no hits on the frame
- [ ] NOT tried in a headset yet

## Photo wall above the bed - run of Mon Oct 19 2026 (Unity sent her real b/w childhood photos: dad's digitised family pictures + city archive street shots; then the ping pong table)
- [x] 11 attachments in chat, two byte-identical (01a15172-...-9f7c and ...-9965) -> 10 unique photos: six kids on the sofa, carnival prince at the hospital crib, ping pong table, 7 street shots
- [x] tools/make_gallery_atlas.py packs them untouched (no resize/crop/recolour, 8 px edge-extended borders) into assets/img/gallery_atlas.jpg (2048x2048, 3 cols x 4 rows) and prints the UV rects pasted into js/gallery.js
- [x] js/gallery.js: left wall (x = -RX) above the headboard, world z -1.11..1.36, y 1.21..2.35; scattered gallery-wall style (Unity: no grid, organic, some overlapping, varied heights/sizes, each in its own frame): walnut / black / gold / white / oak frames, some with cream mats, tilts -2..2.2 deg; overlapping frames hang one layer (2.2 cm) further out on a dark spacer inset 5 cm; soft shadow on the wallpaper per frame. 3 draw calls (frames vertex-coloured, photos atlas, shadows), no lights, no interaction
- [x] tools/test_gallery.py: 10 photos loaded, aspect kept, on the wall / above headboard / below rail / clear of socials poster + shelf, scattered (10 heights, 9 widths), overlapping pairs on different layers, spacers clear, every photo the first hit from 3 spots, on-screen pixels are the print (not wallpaper), 0 errors; find_coplanar: no hits on the photo wall
- [ ] NOT seen in a headset yet

## 2026-10-19 (night) — photo wall without board, light switch, Roomba voice
- Photo wall (js/gallery.js): cork board removed after the Quest test ("massive, takes away from the images"). The ten
  photos are taped straight onto the wallpaper above the bed, real-life print sizes (14-17.5 cm tall photos, 1.2 cm white
  borders), tape only on the borders, same order as before (no swaps). tools/test_gallery.py updated (no_cork_board,
  real_life_print_size, taped_only).
- Light switch (js/nightlight.js): cream rocker switch on the front wall right of the door (x -0.80, y 1.22), works
  with the Quest trigger ray and desktop click/tap. Off = ceiling lamp light 0, room fill x0.08, moonlight x0.32, grey
  readability self-light on prints/posters x0.28, new flush ceiling fitting goes dark, amber locator LED on. Stays on:
  lava lamp, ceiling stars, the existing fairy lights over the Xanadu poster (poster lit by them at night), Xanadu
  mirror image + pink neon, Parallel Universe keycard poster, TV, statues. tools/test_lights.py.
- Roomba voice (js/roomba.js, tools/make_roomba_voice.py -> assets/audio/roomba_voice.mp3/.json): floating bubble
  retired (showed through the bed); all 152 lines spoken by Piper en_GB-alan-medium + robot filter, checked with
  faster-whisper (no misheard swear words), plus a synthetic small-room echo. ElevenLabs (robot filter + small room)
  NOT used: no API key on the VM and the ElevenLabs sign-in wasn't completed; swap the sprite if that becomes possible.
  Greets once per visit. Punishment: walk over a spot it cleaned in the last
  25 s while it's within 3 m -> 50% chance, 4 min cooldown: "Where do you think you're going? ..." then the full song
  'The Roomba Ran Away' (~/the_roomba_ran_away.wav -> assets/audio/the_roomba_ran_away.mp3, 2:49) from its speaker while
  it dances round your feet; pet it to cancel. Trail check runs every 0.25 s along your path since the last check (a
  quick step across a cleaned strip counts). tools/test_roomba_voice.py.
- Roomba voice v2 = Unity's own ElevenLabs clips: "Eva - Futuristic Robot Helper" (Eleven v4), all 152 lines in one
  346 s mp3 from her Google Drive (~/eva_clips/eva_all.mp3), lines in sorted-key order. Cut points in
  tools/roomba_voice_eva_cuts.json (cut on pauses >= 0.3 s, faster-whisper on each piece, DP grouping to the lines; hand
  cuts: 'feet! | Ow!' and the three snoring lines). tools/make_roomba_voice_eva.py: trim, even out loudness, light
  small-room echo (no robot filter), 32 kHz 64k CBR sprite. Every clip re-checked with speech-to-text. Piper sprite retired.
- Captions are back (like the statues): pixel bubble with a gold stripe over the Roomba while it talks; while it's under
  the bed it floats just above the mattress (y 0.78) instead of showing through. R.captionDebug(), R.say(), R.place().
- Punishment song is now a 20.8 s loop of the chorus (assets/audio/the_roomba_ran_away_short.mp3, 31.05-51.85 s of the
  full track, 56 beats at 161.5 bpm) instead of the full 2:49 song. It loops while you stay, stops when you walk to the
  door (within 1.05 m of x -1.4, z +RZ, after 3 s of song) with 'PUNISHMENT OVER. YOU MAY GO.', 45 s max. Bumps and
  feet mid-dance: quiet back-up wiggle, no lines over the song. Pet still cancels.
- [ ] Roomba voice NOT heard in a headset yet

## 2026-10-19 (evening) — two stickers on the door
- js/stickers.js: Unity's 'lol' and 'Wt...feathers' stickers (her transparent PNG cutouts from Drive, byte-identical:
  assets/img/sticker_lol.png, assets/img/sticker_feathers.png) stuck on the inside of the door. lol 16 cm tall, lower-left
  of the upper panel (as you face the door), tilted 7 deg, clear of the ROOMBA XING sign; feathers 15 cm, top of the lower
  panel by the latch side, tilted -5 deg, below the knob. 2.5 mm off the panel, no depth write, polygon offset (no
  z-fighting); premultiplied texture + blending (no dark fringe from the black RGB under alpha 0); grey self-light so the
  light switch dims them at night. Door geometry untouched. tools/test_stickers.py.
- [ ] NOT seen in a headset yet
