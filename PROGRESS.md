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
- [ ] publish (git push to unityeagleai/roomba, check live)
