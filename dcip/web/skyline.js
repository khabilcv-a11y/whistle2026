/* A faint, slowly moving Kozhikode skyline for the page backgrounds: Kappad (Vasco da Gama memorial), Mishkal Mosque,
 * Tali temple, the Beach lighthouse, a Beypore uru under sail, coconut palms and the Arabian Sea.
 *   DCIPSkyline.mount(element)  – adds it behind the element's content (the element must be position: relative). */
(function (w) {
  'use strict';
  var CSS = '.sky{position:absolute;left:0;right:0;bottom:0;height:min(46%,340px);min-height:170px;pointer-events:none;z-index:0;overflow:hidden;color:#fff;opacity:.17}' +
    '.sky svg{position:absolute;bottom:0;left:50%;width:max(1440px,100%);height:100%;transform:translateX(-50%)}' +
    '.sky .ln{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}.sky .fl{fill:currentColor;fill-opacity:.22}.sky .fl2{fill:currentColor;fill-opacity:.1}' +
    '.sky .wv1{animation:skyw 22s linear infinite}.sky .wv2{animation:skyw 34s linear infinite reverse}' +
    '.sky .uru{animation:skysail 95s linear infinite}.sky .bob{animation:skybob 5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
    '.sky .beam{animation:skybeam 9s ease-in-out infinite;transform-origin:1080px 128px}.sky .cl{animation:skycl 120s linear infinite}.sky .cl2{animation:skycl 170s linear infinite;animation-delay:-60s}' +
    '.sky .palm{animation:skysway 7s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}.sky .bird{animation:skybird 48s linear infinite}.sky .twk{animation:skytw 3.2s ease-in-out infinite}' +
    '@keyframes skyw{to{transform:translateX(-720px)}}@keyframes skysail{from{transform:translateX(1500px)}to{transform:translateX(-380px)}}@keyframes skybob{50%{transform:translateY(-4px) rotate(-1.2deg)}}' +
    '@keyframes skybeam{0%,100%{opacity:.05;transform:rotate(-7deg)}50%{opacity:.55;transform:rotate(5deg)}}@keyframes skycl{from{transform:translateX(-300px)}to{transform:translateX(1800px)}}' +
    '@keyframes skysway{50%{transform:rotate(2.2deg)}}@keyframes skybird{from{transform:translate(-120px,0)}to{transform:translate(1700px,-30px)}}@keyframes skytw{50%{opacity:.25}}' +
    '@media (prefers-reduced-motion:reduce){.sky *{animation:none!important}}html.a11y-calm .sky *{animation:none!important}html.a11y-hc .sky{display:none}' +
    '.sky.dark{color:#14305a;opacity:.1}';
  var wave = function (y, c) { var p = 'M0 ' + y; for (var x = 0; x < 2880; x += 120) p += ' q30 -9 60 0 t60 0'; return '<path class="' + c + ' ln" d="' + p + '"/>'; };
  var SVG = '<svg viewBox="0 0 1440 340" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">' +
    /* sky: clouds, birds, stars */
    '<g class="cl"><path class="fl2" d="M0 70q16-26 44-18 14-22 44-8 30-4 36 20 22 2 24 16H0z"/></g><g class="cl2" transform="translate(0,34)"><path class="fl2" d="M0 70q16-26 44-18 14-22 44-8 30-4 36 20 22 2 24 16H0z"/></g>' +
    '<g class="bird"><path class="ln" d="M0 60q7-9 14 0 7-9 14 0M40 74q6-8 12 0 6-8 12 0M84 54q5-7 10 0 5-7 10 0"/></g>' +
    '<g class="twk"><circle class="fl" cx="640" cy="40" r="2"/><circle class="fl" cx="980" cy="26" r="1.6"/><circle class="fl" cx="260" cy="30" r="1.8"/><circle class="fl" cx="1300" cy="52" r="1.6"/></g>' +
    /* Kappad: Vasco da Gama memorial on its rocks */
    '<g><path class="fl" d="M40 292l34-26 40-6 38 8 36 24z"/><path class="ln" d="M40 292l34-26 40-6 38 8 36 24"/><path class="fl" d="M92 262V190h26v72z"/><path class="ln" d="M92 262V190h26v72M92 190l13-26 13 26M100 214h10M100 232h10"/>' +
    '<path class="ln" d="M70 266l-12 12M146 268l14 12"/></g>' +
    /* Mishkal mosque: stacked timber roofs and a minaret */
    '<g><path class="fl2" d="M250 292v-62h170v62z"/><path class="ln" d="M250 292v-62h170v62M250 230h170"/>' +
    '<path class="fl" d="M236 230l99-46 99 46z"/><path class="ln" d="M236 230l99-46 99 46M258 184l77-38 77 38"/><path class="fl" d="M258 184l77-38 77 38z"/><path class="ln" d="M282 146l53-30 53 30"/><path class="fl" d="M282 146l53-30 53 30z"/>' +
    '<path class="ln" d="M335 116V92M330 98h10"/><path class="ln" d="M268 292v-36q0-12 11-12t11 12v36M310 292v-36q0-12 11-12t11 12v36M352 292v-36q0-12 11-12t11 12v36M394 292v-26"/>' +
    '<path class="fl" d="M446 292V196h18v96z"/><path class="ln" d="M446 292V196h18v96M446 196q9-26 18 0M455 170v-18M449 160h12"/></g>' +
    /* Tali temple: tiered Kerala roofs and a lamp pillar */
    '<g><path class="fl2" d="M560 292v-58h170v58z"/><path class="ln" d="M560 292v-58h170v58M585 292v-58M625 292v-58M665 292v-58M705 292v-58"/>' +
    '<path class="fl" d="M538 234l107-64 107 64z"/><path class="ln" d="M538 234l107-64 107 64M572 170l73-46 73 46"/><path class="fl" d="M572 170l73-46 73 46z"/>' +
    '<path class="ln" d="M645 124V96M640 100q5-10 10 0"/><circle class="fl" cx="645" cy="92" r="3"/><circle class="fl" cx="540" cy="234" r="3"/><circle class="fl" cx="750" cy="234" r="3"/>' +
    '<path class="ln" d="M780 292V196M770 196h20M772 206h16M768 222h24"/><circle class="fl twk" cx="780" cy="190" r="5"/></g>' +
    /* Kozhikode beach lighthouse with its sweeping beam */
    '<g><path class="fl" d="M1058 292l14-168h16l14 168z"/><path class="ln" d="M1058 292l14-168h16l14 168M1066 224h28M1069 176h22"/><path class="ln" d="M1062 124h36v-6h-36zM1070 118V96h20v22M1068 96q12-18 24 0M1080 78V66"/>' +
    '<g class="beam"><path d="M1080 128L1500 60V196z" fill="url(#skyg)"/></g></g>' +
    /* palms */
    '<g class="palm"><path class="ln" d="M1200 292q-6-70 14-130"/><path class="ln" d="M1214 162q-34-4-58 20M1214 162q-20-26-54-20M1214 162q10-30 44-30M1214 162q34-8 56 14M1214 162q22 8 34 36"/></g>' +
    '<g class="palm" style="animation-delay:-3s"><path class="ln" d="M1290 292q10-56-2-104"/><path class="ln" d="M1288 188q-30 0-50 24M1288 188q-14-26-48-22M1288 188q12-26 40-22M1288 188q30 0 46 22"/></g>' +
    '<g class="palm" style="animation-delay:-1.5s"><path class="ln" d="M20 292q8-60-4-116"/><path class="ln" d="M16 176q-26 2-44 22M16 176q-8-24-38-24M16 176q14-26 44-18M16 176q26 4 40 26"/></g>' +
    /* sea + the uru under sail */
    '<path class="fl2" d="M0 292h1440v48H0z"/>' +
    '<g class="uru"><g class="bob"><path class="fl" d="M0 286h132l-16 22H18z"/><path class="ln" d="M0 286h132l-16 22H18zM132 286l16-12M0 286l-10-14"/><path class="ln" d="M52 286V204M92 286V222"/>' +
    '<path class="fl" d="M54 206l56 52H54z"/><path class="ln" d="M54 206l56 52H54z"/><path class="fl2" d="M92 224l34 48H92z"/><path class="ln" d="M92 224l34 48H92z"/></g></g>' +
    '<g transform="translate(0,296)">' + wave(0, 'wv1') + '</g><g transform="translate(-300,314)">' + wave(0, 'wv2') + '</g><g transform="translate(-120,330)">' + wave(0, 'wv1') + '</g>' +
    '<defs><linearGradient id="skyg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs></svg>';

  function mount(el, o) {
    if (!el || el.querySelector(':scope > .sky')) return;
    if (!document.getElementById('skyCss')) { var st = document.createElement('style'); st.id = 'skyCss'; st.textContent = CSS; document.head.appendChild(st); }
    var d = document.createElement('div'); d.className = 'sky' + (o && o.dark ? ' dark' : ''); d.innerHTML = SVG; el.insertBefore(d, el.firstChild);
  }
  w.DCIPSkyline = { mount: mount };
})(window);
