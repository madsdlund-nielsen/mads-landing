// End-to-end test. Kør via tests/run.sh.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SITE = 'http://127.0.0.1:8090';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'screenshots');
const sql = (q) => execSync(`mysql --default-character-set=utf8mb4 -N mads_test -e ${JSON.stringify(q)}`).toString().trim();
const curl = (args) => execSync(`curl -s ${args}`).toString();
let failures = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ' ' + extra}`); if (!ok) failures++; };
const PAGES = ['/', '/kurser/', '/bogen/', '/priser/', '/kontakt/'];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

  // Alle sider: indlæses, ingen konsolfejl, SEO, links, ingen vandret scroll
  const internal = new Set();
  for (const p of PAGES) {
    for (const [w, label] of [[1280, 'desktop'], [390, 'mobil']]) {
      await page.setViewportSize({ width: w, height: 900 });
      errors.length = 0;
      await page.goto(SITE + p, { waitUntil: 'networkidle' });
      check(`${p} ${label}: ingen konsol-/netværksfejl`, errors.length === 0, errors.join(' | '));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${p} ${label}: ingen vandret scroll`, overflow <= 0, `overflow ${overflow}px`);
      if (w === 1280) {
        await page.screenshot({ path: `${SHOTS}/${p === '/' ? 'home' : p.replace(/\//g, '')}-${label}.png`, fullPage: true });
        const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
        hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//')).forEach((h) => internal.add(h.split('#')[0].split('?')[0]));
        const imgs = await page.$$eval('img', (is) => is.map((i) => [i.getAttribute('src'), i.naturalWidth, !!i.getAttribute('width'), !!i.getAttribute('height'), !!i.getAttribute('alt')]));
        check(`${p}: billeder indlæst med width/height/alt`, imgs.every(([, nw, w1, h1, a]) => nw > 0 && w1 && h1 && a), JSON.stringify(imgs));
      }
    }
    const meta = await page.evaluate(() => ({
      lang: document.documentElement.lang, canon: document.querySelector('link[rel=canonical]')?.href,
      desc: document.querySelector('meta[name=description]')?.content, og: document.querySelector('meta[property="og:image"]')?.content,
      h1: document.querySelectorAll('h1').length, cur: document.querySelector('.nav a[aria-current=page]')?.getAttribute('href'),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)),
    }));
    check(`${p}: lang=da, canonical, description, og:image, én h1, aktiv nav`,
      meta.lang === 'da' && meta.canon === 'https://madslundnielsen.dk' + p && meta.desc?.length > 50 && meta.og?.endsWith('og-image.png') && meta.h1 === 1 && meta.cur === p, JSON.stringify(meta));
    if (p === '/') check('forside: titel + JSON-LD Person/WebSite', (await page.title()) === 'Mads Dahlén Lund-Nielsen | ESG-kurser, Keynotes & Rådgivning' && JSON.stringify(meta.ld).includes('"Person"') && JSON.stringify(meta.ld).includes('"WebSite"'));
    if (p === '/kurser/') check('kurser: 3 Course med DKK-tilbud', meta.ld[0]['@graph'].filter((x) => x['@type'] === 'Course' && x.offers.priceCurrency === 'DKK').length === 3);
    if (p === '/bogen/') check('bogen: JSON-LD Book', meta.ld[0]['@type'] === 'Book');
  }
  for (const h of internal) {
    const code = curl(`-o /dev/null -w '%{http_code}' '${SITE}${h}'`);
    check(`internt link ${h} svarer`, code === '200' || code === '302' || code === '303', code);
  }
  for (const f of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/404.html', '/assets/img/og-image.png', '/assets/img/favicon.svg', '/assets/img/apple-touch-icon.png']) {
    check(`${f} findes`, curl(`-o /dev/null -w '%{http_code}' ${SITE}${f}`) === '200');
  }
  check('sitemap indeholder 5 sider', (curl(`${SITE}/sitemap.xml`).match(/<loc>/g) || []).length === 5);

  // Kurser: faner + deep links + uden JS
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SITE + '/kurser/#vsme');
  check('deep link #vsme viser VSME-kurset', await page.isVisible('#vsme') && !(await page.isVisible('#halv')) && (await page.getAttribute('#tab-vsme', 'aria-selected')) === 'true');
  await page.click('#tab-hel');
  check('fanen Heldags skifter kursus + hash', await page.isVisible('#hel') && !(await page.isVisible('#vsme')) && page.url().endsWith('#hel'));
  check('Heldags: pris 3.500 og 14 programrækker', (await page.textContent('#hel .side__price strong')).includes('3.500 kr.') && (await page.$$('#hel .prog-row:not(.prog-row--head)')).length === 14);
  check('"Forespørg om hold" peger på kontakt med interesse', (await page.getAttribute('#hel .side__cta a', 'href')) === '/kontakt/?interesse=hel');
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto(SITE + '/kurser/');
  check('uden JS: alle tre kurser og ingen faner', (await np.isVisible('#halv')) && (await np.isVisible('#hel')) && (await np.isVisible('#vsme')) && !(await np.isVisible('.tabs')));
  await np.goto(SITE + '/priser/');
  check('uden JS: statisk standardpris 24.000 kr.', (await np.textContent('[data-calc-total]')).trim() === '24.000');

  // Priskalkulator
  await page.goto(SITE + '/priser/');
  check('prisrække Heldags 3.500 kr.', (await page.textContent('.ptable')).includes('3.500 kr.'));
  await page.click('[data-calc-course=hel]');
  await page.fill('[data-calc-range]', '15');
  await page.dispatchEvent('[data-calc-range]', 'input');
  check('kalkulator: Heldags × 15 = 52.500, moms 13.125',
    (await page.textContent('[data-calc-per]')) === '3.500' && (await page.textContent('[data-calc-total]')) === '52.500' && (await page.textContent('[data-calc-vat]')) === '13.125');
  check('kalkulator-link til kontakt', (await page.getAttribute('[data-calc-cta]', 'href')) === '/kontakt/?interesse=hel&deltagere=15');

  // Kontaktformular med JS
  await page.goto(SITE + '/kontakt/?interesse=hel&deltagere=15');
  check('kontakt: forudfyldt fra query', (await page.inputValue('select[name=interest]')) === 'hel' && (await page.inputValue('input[name=participants]')) === '15');
  await page.fill('input[name=name]', 'Mette Hansen');
  await page.fill('[data-contact-form] input[name=email]', 'mette@example.dk');
  await page.fill('input[name=company]', 'Hansen & Søn A/S');
  await page.fill('input[name=cvr]', '12345678');
  await page.fill('textarea[name=message]', 'Vi er 14 medarbejdere i fødevarebranchen.');
  await page.click('[data-contact-form] button[type=submit]');
  await page.waitForSelector('[data-contact-thanks]:not([hidden])');
  check('kontakt (JS): tak-tilstand vist', await page.isVisible('text=Tak for din henvendelse'));
  check('kontakt (JS): række i MySQL', sql("SELECT CONCAT(name,'|',email,'|',company,'|',cvr,'|',interest,'|',participants,'|',mail_sent) FROM inquiries ORDER BY id DESC LIMIT 1") === 'Mette Hansen|mette@example.dk|Hansen & Søn A/S|12345678|hel|15|1');
  await page.screenshot({ path: `${SHOTS}/kontakt-tak.png` });
  const mail = fs.readFileSync('/tmp/md-mail.log', 'utf8');
  check('mail: To, From, Reply-To, UTF-8', /To: mads@qlim8\.com/i.test(mail) && /From: madslundnielsen\.dk <no-reply@madslundnielsen\.dk>/i.test(mail) && /Reply-To: .*<mette@example\.dk>/i.test(mail) && /charset=UTF-8/i.test(mail), mail.slice(0, 600));
  check('mail: indhold med virksomhed og interesse', mail.includes('Hansen & Søn A/S') && mail.includes('Heldags ESG-grundkursus Plus'));

  // Validering, honeypot, header-injection
  const bad = curl(`-H 'Accept: application/json' -d 'name=X&email=ikke-en-mail' ${SITE}/kontakt.php`);
  check('kontakt: ugyldig e-mail afvises (JSON 422)', JSON.parse(bad).ok === false && sql('SELECT COUNT(*) FROM inquiries') === '1');
  const bot = curl(`-H 'Accept: application/json' -d 'name=Bot&email=b@example.dk&website=http://spam' ${SITE}/kontakt.php`);
  check('kontakt: honeypot fejler stille og gemmer intet', JSON.parse(bot).ok === true && sql('SELECT COUNT(*) FROM inquiries') === '1');
  curl(`-H 'Accept: application/json' --data-urlencode $'name=Evil\\r\\nBcc: x@evil.dk' -d 'email=e@example.dk' ${SITE}/kontakt.php`);
  const mail2 = fs.readFileSync('/tmp/md-mail.log', 'utf8');
  check('kontakt: ingen header-injektion', !/^Bcc:/mi.test(mail2));

  // Kontaktformular uden JS: POST → 303 → ?sendt=1 med tak-tilstand
  const noJsPost = curl(`-i -d 'name=Peter+Nielsen&email=peter@example.dk&interest=vsme&participants=9&message=hej' ${SITE}/kontakt.php`);
  check('kontakt (uden JS): 303 til /kontakt/?sendt=1', /^HTTP\/1\.1 303/.test(noJsPost) && /Location: \/kontakt\/\?sendt=1/i.test(noJsPost));
  check('kontakt (uden JS): række gemt', sql("SELECT COUNT(*) FROM inquiries WHERE email='peter@example.dk' AND interest='vsme' AND participants=9") === '1');
  await np.goto(SITE + '/kontakt/?sendt=1#tak');
  check('kontakt (uden JS): tak-tilstand vises, formular skjult', (await np.isVisible('#tak')) && !(await np.isVisible('[data-contact-form]')));
  await page.goto(SITE + '/kontakt/?sendt=1');
  check('kontakt (JS): ?sendt=1 viser tak', await page.isVisible('[data-contact-thanks]'));

  // Nyhedsbrev med JS
  await page.goto(SITE + '/');
  await page.fill('[data-nl-form] input[name=name]', 'Lars');
  await page.fill('[data-nl-form] input[name=email]', 'lars@example.dk');
  await page.check('[data-nl-form] input[name=consent]');
  await page.click('[data-nl-form] button[type=submit]');
  await page.waitForSelector('[data-nl-thanks]:not([hidden])');
  check('nyhedsbrev (JS): række med samtykke-tidspunkt', sql("SELECT CONCAT(name,'|',source,'|',consent_at IS NOT NULL,'|',consent LIKE 'Jeg accepterer%') FROM newsletter WHERE email='lars@example.dk'") === 'Lars|forside|1|1');
  check('nyhedsbrev: dublet giver stadig én række', (curl(`-H 'Accept: application/json' -d 'name=Lars&email=lars@example.dk&consent=1' ${SITE}/nyhedsbrev.php`), sql("SELECT COUNT(*) FROM newsletter WHERE email='lars@example.dk'") === '1'));
  check('nyhedsbrev: uden samtykke afvises', JSON.parse(curl(`-H 'Accept: application/json' -d 'email=x@example.dk' ${SITE}/nyhedsbrev.php`)).ok === false && sql("SELECT COUNT(*) FROM newsletter WHERE email='x@example.dk'") === '0');
  check('nyhedsbrev: honeypot', JSON.parse(curl(`-H 'Accept: application/json' -d 'email=bot@example.dk&consent=1&website=x' ${SITE}/nyhedsbrev.php`)).ok === true && sql("SELECT COUNT(*) FROM newsletter WHERE email='bot@example.dk'") === '0');
  // Nyhedsbrev uden JS (HTML-svar)
  const nlNoJs = curl(`-d 'name=Eva&email=eva@example.dk&consent=1&source=kurser' ${SITE}/nyhedsbrev.php`);
  check('nyhedsbrev (uden JS): HTML-svar + række', nlNoJs.includes('tilmeldt nyhedsbrevet') && sql("SELECT source FROM newsletter WHERE email='eva@example.dk'") === 'kurser');

  // Sikkerhed
  check('GET /kontakt.php redirecter til formularen', curl(`-o /dev/null -w '%{http_code}' ${SITE}/kontakt.php`) === '303');

  await browser.close();
  console.log(failures ? `\n${failures} FEJL` : '\nAlle tests bestod');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
