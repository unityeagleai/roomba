// The on-screen help box (bottom left) when you walk in on a screen, made phone-friendly.
// - Touch screens (phones, tablets): the help uses touch words (drag to look, tap to do things) and says honestly that
//   walking needs a keyboard or a headset. It shows for a few seconds after you walk in, then folds away into a small
//   HELP button. It also folds away the first time you drag or tap in the room. Tap HELP to bring it back, HIDE HELP to fold it.
// - Computers: the help stays up like before, with a HIDE HELP button and the H key to fold it / bring it back.
// The start screen's "On screen:" line gets the same touch wording on touch screens.
(function () {
const RV = window.RV = window.RV || {};
const $ = id => document.getElementById(id);
const mm = q => !!(window.matchMedia && window.matchMedia(q).matches);
const touch = RV.isTouch = RV.QS && RV.QS.has('touch') ? true : (mm('(hover: none) and (pointer: coarse)') || (!mm('(pointer: fine)') && ('ontouchstart' in window || navigator.maxTouchPoints > 0)));
const AUTO_HIDE_S = 7;
let min = false, timer = null, userChose = false;

const TOUCH_HUD = 'drag = look around · tap the floor = crumb · tap the Roomba = boop · tap the red button on its charging station = Roomba to bed / wake up<br>' +
  'tap a cartridge, then the console = play · BIG SCREEN on the TV = wall behind you · tap the red record player<br>' +
  'walking needs a keyboard or a VR headset';
const TOUCH_INTRO = 'On a phone or tablet: drag to look around, tap the floor, the Roomba and things in the room. Walking needs a keyboard or a VR headset, so on a phone you look and tap from where you stand. Tap HELP in the corner to see this again.';

function apply() {
  const h = $('hud'), b = $('bHelp'); if (!h || !b) return;
  h.classList.toggle('min', min);
  b.textContent = min ? 'HELP' : 'HIDE HELP';
  b.setAttribute('aria-expanded', String(!min));
}
function set(v, why) { min = !!v; if (timer) { clearTimeout(timer); timer = null; } apply(); RV.helpLog = (RV.helpLog || []).concat([(min ? 'hide' : 'show') + ':' + why]); }
function shown() { const h = $('hud'); return !!h && !h.classList.contains('gone') && !min; }

// called when you walk in on screen
function onEnter() {
  if (userChose) return;               // keep whatever the user last picked
  set(false, 'enter');
  if (touch) timer = setTimeout(() => { if (!userChose) set(true, 'auto'); }, AUTO_HIDE_S * 1000);
}

function init() {
  if (touch) {
    const t = $('hudText'); if (t) t.innerHTML = TOUCH_HUD;
    const li = $('flatHow'); if (li) li.textContent = TOUCH_INTRO;
  }
  const b = $('bHelp');
  if (b) {
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('pointerup', e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); userChose = true; set(!min, 'button'); });
  }
  const f = $('bFlat'); if (f) f.addEventListener('click', onEnter);
  // on a touch screen, the first drag or tap in the room folds the help away so it stops covering the view
  const stage = $('stage');
  if (stage && touch) stage.addEventListener('pointerdown', () => { if (shown() && !userChose) set(true, 'touch'); }, true);
  addEventListener('keydown', e => {
    if (e.code !== 'KeyH' || e.ctrlKey || e.metaKey || e.altKey) return;
    const h = $('hud'); if (!h || h.classList.contains('gone')) return;
    userChose = true; set(!min, 'key');
  });
  apply();
}
RV.help = { isTouch: () => touch, hidden: () => min, show: () => { userChose = true; set(false, 'api'); }, hide: () => { userChose = true; set(true, 'api'); }, autoHideS: AUTO_HIDE_S };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
