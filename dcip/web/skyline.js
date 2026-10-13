/* A faint, slowly moving Kozhikode skyline for the page backgrounds, drawn from the city's own icons:
 * the station name board, Mishkal Mosque, a Kerala temple roof, the clock tower and town hall, the old sea-bridge pillars
 * standing in the Arabian Sea, and a Beypore uru under sail.
 *   DCIPSkyline.mount(element)  – adds it behind the element's content (the element must be position: relative). */
(function (w) {
  'use strict';
  var CSS = '.sky{position:absolute;left:0;right:0;bottom:0;height:215px;pointer-events:none;z-index:0;overflow:hidden;color:#fff;opacity:.2}' +
    '.sky svg{position:absolute;bottom:0;left:50%;width:max(1440px,100%);height:100%;transform:translateX(-50%)}' +
    '@media (max-width:700px){.sky svg{transform:translateX(-60%)}}' +
    '.sky .ln{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round}.sky .th{fill:none;stroke:currentColor;stroke-width:.9;stroke-linecap:round}.sky .fl{fill:currentColor;fill-opacity:.2}.sky .fl2{fill:currentColor;fill-opacity:.08}.sky .ht{fill:url(#skyh);stroke:none}' +
    '.sky .wv1{animation:skyw 24s linear infinite}.sky .wv2{animation:skyw 38s linear infinite reverse}.sky .uru{animation:skysail 110s linear infinite}.sky .bob{animation:skybob 5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
    '.sky .cl{animation:skycl 130s linear infinite}.sky .cl2{animation:skycl 190s linear infinite;animation-delay:-70s}.sky .palm{animation:skysway 7s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}' +
    '.sky .bird{animation:skybird 52s linear infinite}.sky .sun{animation:skysun 9s ease-in-out infinite}.sky .rip{animation:skyrip 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.sky .rip:nth-child(2n){animation-delay:-1.3s}.sky .rip:nth-child(3n){animation-delay:-2.6s}' +
    '@keyframes skyw{to{transform:translateX(-720px)}}@keyframes skysail{from{transform:translateX(1560px)}to{transform:translateX(-300px)}}@keyframes skybob{50%{transform:translateY(-4px) rotate(-1.2deg)}}' +
    '@keyframes skycl{from{transform:translateX(-300px)}to{transform:translateX(1800px)}}@keyframes skysway{50%{transform:rotate(2.2deg)}}@keyframes skybird{from{transform:translate(-120px,0)}to{transform:translate(1700px,-26px)}}' +
    '@keyframes skysun{50%{opacity:.55}}@keyframes skyrip{50%{transform:scaleX(1.25);opacity:.4}}' +
    '@media (prefers-reduced-motion:reduce){.sky *{animation:none!important}}html.a11y-calm .sky *{animation:none!important}html.a11y-hc .sky{display:none}';
  var wave = function (y, c) { var p = 'M0 ' + y; for (var x = 0; x < 2880; x += 120) p += ' q30 -9 60 0 t60 0'; return '<path class="' + c + ' ln" d="' + p + '"/>'; };
  var PILL = '<g><use href="#pil" transform="translate(1104 302) scale(0.6) rotate(1)"/></g><g><use href="#pil" transform="translate(1156 302) scale(0.6) rotate(2)"/></g><g><use href="#pil" transform="translate(1218 302) scale(0.6) rotate(1)"/></g><g><use href="#pil" transform="translate(1312 302) scale(0.6) rotate(1)"/></g><g><use href="#pil" transform="translate(1362 302) scale(0.6) rotate(2)"/></g><g><use href="#pilb" transform="translate(1424 302) scale(0.6) rotate(2)"/></g><g><use href="#pil" transform="translate(1128 309) scale(0.84) rotate(-1)"/></g><g><use href="#pil" transform="translate(1196 309) scale(0.84) rotate(-1)"/></g><g><use href="#pil" transform="translate(1272 309) scale(0.84) rotate(2)"/></g><g><use href="#pil" transform="translate(1388 309) scale(0.84) rotate(1)"/></g><g><use href="#pil" transform="translate(1152 318) scale(1.12) rotate(2)"/></g><g><use href="#pil" transform="translate(1242 318) scale(1.12) rotate(-1)"/></g><g><use href="#pilb" transform="translate(1346 318) scale(1.12) rotate(-2)"/></g><g><use href="#pil" transform="translate(1182 330) scale(1.5) rotate(1)"/></g><g><use href="#pil" transform="translate(1300 330) scale(1.5) rotate(0)"/></g><g><use href="#pil" transform="translate(1412 330) scale(1.5) rotate(-1)"/></g>';
  var SVG = '<svg viewBox="0 125 1440 215" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><defs>' +
    '<pattern id="skyh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-width=".9" stroke-opacity=".75"/></pattern>' +
    '<radialGradient id="skyg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>' +
    '<filter id="skyr" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>' +
    '<g id="pil"><path class="fl" d="M-6 0L-5 -58L-9.5 -63L-10.5 -71L-6.5 -76.5V-80H6.5V-76.5L10.5 -71L9.5 -63L5 -58L6 0Z"/><path class="ln" d="M-6 0L-5 -58L-9.5 -63L-10.5 -71L-6.5 -76.5V-80H6.5V-76.5L10.5 -71L9.5 -63L5 -58L6 0M-9.5 -63H9.5M-2.5 -80V-74H2.5V-80"/><path class="th" d="M-2 -10V-56M2 -14V-56"/><path class="th rip" d="M-14 1q7 -4 14 0q7 4 14 0"/></g>' +
    '<g id="pilb"><path class="fl" d="M-6 0L-5.5 -36L-3 -42L0 -37L3.5 -45L6 -34L5.5 0Z"/><path class="ln" d="M-6 0L-5.5 -36L-3 -42L0 -37L3.5 -45L6 -34L5.5 0"/><path class="th rip" d="M-13 1q6.5 -4 13 0q6.5 4 13 0"/></g></defs>' +
    /* sky: sun over the sea, clouds, birds */
    '<g class="sun"><circle cx="1290" cy="212" r="120" fill="url(#skyg)" opacity=".4"/></g><circle class="ln" cx="1290" cy="256" r="34"/><path class="th" d="M1130 266H1440M1160 272H1440"/>' +
    '<g transform="translate(0 70)"><g class="cl"><path class="fl2" d="M0 66q16-26 44-18 14-22 44-8 30-4 36 20 22 2 24 16H0z"/></g><g class="cl2" transform="translate(0,30)"><path class="fl2" d="M0 66q16-26 44-18 14-22 44-8 30-4 36 20 22 2 24 16H0z"/></g></g>' +
    '<g class="bird" transform="translate(0 70)"><path class="ln" d="M0 60q7-9 14 0 7-9 14 0M40 74q6-8 12 0 6-8 12 0M84 54q5-7 10 0 5-7 10 0"/></g>' +
    '<g filter="url(#skyr)">' +
    /* Kozhikode railway station board */
    '<g transform="translate(242 298) scale(.76) translate(-242 -298)">' +
    '<path class="th" d="M96 298H372M110 304H358"/><path class="ln" d="M176 298V250M308 298V250M158 196H326V252H158zM164 202H320V246H164z"/><path class="fl2" d="M158 196H326V252H158z"/>' +
    '<text x="242" y="226" text-anchor="middle" font-size="23" font-weight="700" fill="currentColor" font-family="\'Noto Sans Malayalam\',\'Nirmala UI\',Kartika,Manjari,sans-serif">കോഴിക്കോട്</text><text x="242" y="242" text-anchor="middle" font-size="11.5" font-weight="800" letter-spacing="2.4" fill="currentColor" font-family="Arial,Helvetica,sans-serif">KOZHIKODE</text>' +
    '</g>' +
    /* Mishkal mosque: stacked timber roofs, arched ground floor, slender minaret */
    '<g transform="translate(520 298) scale(.76) translate(-520 -298)">' +
    '<path class="fl2" d="M424 298V250H574V298z"/><path class="ln" d="M424 298V250H574V298M424 298H574M440 298V274Q440 262 451 262T462 274V298M474 298V274Q474 262 485 262T496 274V298M508 298V274Q508 262 519 262T530 274V298"/>' +
    '<path class="ht" d="M406 250L499 206L592 250z"/><path class="ln" d="M406 250L499 206L592 250M418 244Q499 214 580 244"/><path class="ht" d="M428 206L499 168L570 206z"/><path class="ln" d="M428 206L499 168L570 206M440 200Q499 176 558 200"/><path class="ht" d="M454 168L499 138L544 168z"/><path class="ln" d="M454 168L499 138L544 168M499 138V108M493 114H505M499 108V100"/><circle class="fl" cx="499" cy="97" r="3"/>' +
    '<path class="fl" d="M612 298V182H630V298z"/><path class="ln" d="M612 298V182H630V298M608 182H634M612 196H630M621 182Q621 164 621 154M612 154Q621 130 630 154zM621 130V114"/><circle class="fl" cx="621" cy="111" r="3"/>' +
    '</g>' +
    /* Kerala temple roof with arched doorway (as in the city's artwork) */
    '<g transform="translate(750 298) scale(.76) translate(-750 -298)">' +
    '<path class="ht" d="M652 298V250L726 170L800 250V298z"/><path class="ln" d="M652 298V250L726 170L800 250V298M652 250H800M680 250L726 200L772 250"/><path class="ln" d="M706 298V266Q726 236 746 266V298"/><path class="th" d="M672 262H690M762 262H780M668 276H688M764 276H784M726 170V140M720 146Q726 134 732 146"/><circle class="fl" cx="726" cy="134" r="3.4"/>' +
    '<path class="ln" d="M800 270H858L842 298H800M810 270L826 252H858L858 270"/><path class="th" d="M812 280H848"/>' +
    '</g>' +
    /* clock tower */
    '<g transform="translate(922 298) scale(.76) translate(-922 -298)">' +
    '<path class="fl2" d="M894 298V144H950V298z"/><path class="ln" d="M894 298V144H950V298M888 298H956M894 232H950M894 144H950"/><circle class="ln" cx="922" cy="176" r="17"/><circle class="th" cx="922" cy="176" r="13"/><path class="ln" d="M922 176V166M922 176L930 180"/><path class="ln" d="M906 258V246Q906 238 913 238T920 246V258M924 258V246Q924 238 931 238T938 246V258"/>' +
    '<path class="fl" d="M890 144Q922 100 954 144z"/><path class="ln" d="M890 144Q922 100 954 144M922 110V88"/><circle class="fl" cx="922" cy="84" r="3.4"/><path class="th" d="M894 144L890 150H954L950 144"/>' +
    '</g>' +
    /* town hall with columns */
    '<g transform="translate(1042 298) scale(.76) translate(-1042 -298)">' +
    '<path class="fl2" d="M972 298V238H1112V298z"/><path class="ln" d="M962 238H1122L1042 202zM972 298V238M1112 298V238M964 298H1120M968 292H1116M986 298V238M1006 298V238M1026 298V238M1058 298V238M1078 298V238M1098 298V238M1026 298V262Q1042 246 1058 262V298"/><path class="ht" d="M962 238L1042 202L1122 238z"/>' +
    '<path class="ln" d="M1010 202Q1042 160 1074 202M1042 168V150"/><circle class="th" cx="1042" cy="226" r="6"/>' +
    '</g>' +
    '</g>' +
    /* the old sea-bridge pillars in the sea */
    '<g filter="url(#skyr)">' + PILL + '</g>' +
    /* palms */
    '<g transform="translate(60 298) scale(.8) translate(-60 -298)"><g class="palm"><path class="ln" d="M44 298q-8-64 12-124"/><path class="ln" d="M56 174q-34-4-56 22M56 174q-18-28-52-22M56 174q12-30 44-28M56 174q34-8 56 14M56 174q22 8 32 34"/></g>' +
    '<g class="palm" style="animation-delay:-3s"><path class="ln" d="M132 298q10-56 0-100"/><path class="ln" d="M132 198q-28 0-48 22M132 198q-14-26-46-22M132 198q12-26 40-22M132 198q30 0 46 22"/></g></g>' +
    /* sea and the uru under sail */
    '<path class="fl2" d="M0 300H1440V340H0z"/>' +
    '<g class="uru"><g class="bob"><path class="fl" d="M0 292h138l-18 24H20z"/><path class="ln" d="M0 292h138l-18 24H20zM138 292l16-14M0 292l-10-16"/><path class="ln" d="M56 292V208M96 292V226"/><path class="fl" d="M58 210l58 54H58z"/><path class="ln" d="M58 210l58 54H58z"/><path class="fl2" d="M96 228l36 50H96z"/><path class="ln" d="M96 228l36 50H96z"/></g></g>' +
    '<g transform="translate(0,310)">' + wave(0, 'wv1') + '</g><g transform="translate(-300,326)">' + wave(0, 'wv2') + '</g>' +
    '</svg>';

  function mount(el, o) {
    if (!el || el.querySelector(':scope > .sky')) return;
    if (!document.getElementById('skyCss')) { var st = document.createElement('style'); st.id = 'skyCss'; st.textContent = CSS; document.head.appendChild(st); }
    var d = document.createElement('div'); d.className = 'sky' + (o && o.dark ? ' dark' : ''); d.innerHTML = SVG; el.insertBefore(d, el.firstChild);
  }
  w.DCIPSkyline = { mount: mount };
})(window);
