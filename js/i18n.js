// Simple i18n module with FI and EN translations
// Global I18N object with API: setLang, t, init, getLang
(function(){
  const messages = {
    fi: {
      title: 'Avaruusbiljardi',
      proto: 'Prototyyppi – 2 pelaajaa, vuorottainen lyönti tai gravisiirto (joka toinen oma vuoro). Tavoite 7 pistettä.',
      playerA: 'Pelaaja A',
      playerB: 'Pelaaja B',
      turn: 'Vuoro',
      shoot: 'Lyö (hiirellä vedä & vapauta)',
      move: 'Gravisiirto',
      reset: 'Uusi peli',
      legendS: 'Pieni massa',
      legendM: 'Keskimassa',
      legendL: 'Suuri massa',
      legendBall: 'Pallo',
      howto: 'Ohje',
      howto1: 'Vasen hiiri: pidä ja vedä aloitusalueelta → lyönti suunta/potku (kun Lyö-tila).',
      howto2: '"Gravisiirto"-tilassa: raahaa yhtä omaa massaa ≤ 100 px. Ei keskiviivan yli.',
      howto3: 'Tasku kulmassa = +1 piste. Osuma massaan = pallo poissa.',
      howto4: 'Gravisiirto on sallittu joka toisella omalla vuorolla.',
      physicsNote: 'Näytön koon muuttuessa pöytä skaalautuu. Fysiikka: potentiaalikuopat, kiihtyvyys ~ ∇V; kitka ja seinäkimpoama vaimennuksella.',
      win: (winner)=>`Voitto: ${winner}!`,
      endNoHits: 'Peli päättyy: kolme peräkkäistä lyöntiä ilman osumaa vastustajan massaan.',
      langLabel: 'Kieli',
    },
    en: {
      title: 'Space Pool',
      proto: 'Prototype – 2 players, alternate shot or gravity move (every other own turn). Target 7 points.',
      playerA: 'Player A',
      playerB: 'Player B',
      turn: 'Turn',
      shoot: 'Shoot (drag & release with mouse)',
      move: 'Gravity move',
      reset: 'New game',
      legendS: 'Small mass',
      legendM: 'Medium mass',
      legendL: 'Large mass',
      legendBall: 'Ball',
      howto: 'How to play',
      howto1: 'Left mouse: hold and drag from the spawn circle → shot direction/power (when in Shoot mode).',
      howto2: 'In “Gravity move” mode: drag one of your own masses ≤ 100 px. Not across the midline.',
      howto3: 'Corner pocket = +1 point. Hitting a mass = ball removed.',
      howto4: 'Gravity move is allowed every other own turn.',
      physicsNote: 'When the screen size changes, the table scales. Physics: potential wells, acceleration ~ ∇V; friction and wall bounce with damping.',
      win: (winner)=>`Winner: ${winner}!`,
      endNoHits: 'Game ends: three consecutive shots without hitting an opponent mass.',
      langLabel: 'Language',
    }
  };

  const storageKey = 'spacepool.lang';
  const getDefaultLang = () => {
    const saved = localStorage.getItem(storageKey);
    if(saved && messages[saved]) return saved;
    const nav = (navigator.language || navigator.userLanguage || 'en').slice(0,2).toLowerCase();
    return messages[nav]? nav : 'en';
  };

  let current = getDefaultLang();

  function setLang(lang){
    if(!messages[lang]) return;
    current = lang;
    localStorage.setItem(storageKey, lang);
    translateStatic();
  }

  function t(key, ...args){
    const m = messages[current][key];
    if(typeof m === 'function') return m(...args);
    return m ?? key;
  }

  function getLang(){ return current; }

  function translateStatic(){
    const $ = (sel)=>document.querySelector(sel);
    const setText = (sel, val)=>{ const el=$(sel); if(el) el.textContent = val; };
    document.title = `${t('title')} – prototyyppi`;
    setText('h1', `🌌 ${t('title')}`);
    setText('#proto', t('proto'));
    setText('#shootBtn', t('shoot'));
    setText('#moveBtn', t('move'));
    setText('#resetBtn', t('reset'));
    setText('#legendS', t('legendS'));
    setText('#legendM', t('legendM'));
    setText('#legendL', t('legendL'));
    setText('#legendBall', t('legendBall'));
    setText('#howtoLbl', t('howto'));
    setText('#howto1', t('howto1'));
    setText('#howto2', t('howto2'));
    setText('#howto3', t('howto3'));
    setText('#howto4', t('howto4'));
    const sel = $('#langSelect');
    if(sel){ sel.value = getLang(); }
  }

  function init(){ translateStatic(); }

  window.I18N = { setLang, t, init, getLang };
})();


