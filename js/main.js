  // --- Koordinaatit, apurit --------------------------------------------------
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const ui = {
    sA: document.getElementById('sA'),
    sB: document.getElementById('sB'),
    turn: document.getElementById('turn'),
    shootBtn: document.getElementById('shootBtn'),
    moveBtn: document.getElementById('moveBtn'),
    resetBtn: document.getElementById('resetBtn')
  };

  const W = () => canvas.width;
  const H = () => canvas.height;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax,ay,bx,by)=>{const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy};
  const lerp = (a,b,t)=>a+(b-a)*t;

  // --- Peli-tila --------------------------------------------------------------
  const STATE = {
    scores:{A:0,B:0},
    turn:'A', // 'A' tai 'B'
    allowGraviMove:{A:true, B:true},
    mode:'shoot', // 'shoot' | 'move'
    ball:null,
    masses:[],
    goals:[],
    started:false,
    bonusMove:false,      // erikoissiirto käytettävissä lyönnistä saadun pisteen jälkeen
    wasBonusMove:false,   // viimeisin siirto oli bonus-siirto
    noOpponentHitShots:0, // peräkkäisten lyöntien määrä ilman osumaa vastustajan massaan
    opponentHitThisTurn:false, // tämän vuoron aikana osuttiinko vastustajan massaan
  };

  // Asetukset
  const CONF = {
    G: 2200,            // "gravitaatiovakio" - suurempi = jyrkemmät kaivot
    soft: 1200,         // pehmennys singulariteetin välttämiseksi
    friction: 0.995,    // liikekitka (per frame)
    wallLoss: 0.85,     // seinäkimpoaman energiahäviö
    pocketR: 34,
    ballR: 9,
    massR:{S:22, M:30, L:38},
    massM:{S:0.9, M:1.8, L:2.8}, // vaikuttaa kaivon syvyyteen
    spawnA:{x:0.12, y:0.5},      // suhteelliset aloituspaikat (vasen/oikea)
    spawnB:{x:0.88, y:0.5},
    graviStepMax:100,            // px / siirto
    targetScore:7
  };

  function resetGame(){
    STATE.scores.A = 0; STATE.scores.B = 0;
    STATE.turn = 'A';
    STATE.allowGraviMove.A = true; STATE.allowGraviMove.B = true;
    STATE.mode = 'shoot';
    STATE.masses = [];
    // Kulmataskut
    STATE.goals = [
      {x:40, y:40}, {x:W()-40, y:40}, {x:40, y:H()-40}, {x:W()-40, y:H()-40}
    ];
    // Massat: keskellä iso
    STATE.masses.push(newMass(W()/2, H()/2, 'L', 'N'));
    // Pelaajan omat: kaksi M + yksi S per puoli
    const padX = 120, padY = 120;
    // Pelaaja A vasemmalla: kaksi M ylä/ala ja S vielä vasemmalle
    STATE.masses.push(newMass(W()/2 - padX, H()/2 - padY, 'M', 'A'));
    STATE.masses.push(newMass(W()/2 - padX, H()/2 + padY, 'M', 'A'));
    STATE.masses.push(newMass(W()/2 - padX*1.4, H()/2, 'S', 'A'));

    // Pelaaja B oikealla: kaksi M ylä/ala ja S vielä oikealle
    STATE.masses.push(newMass(W()/2 + padX, H()/2 - padY, 'M', 'B'));
    STATE.masses.push(newMass(W()/2 + padX, H()/2 + padY, 'M', 'B'));
    STATE.masses.push(newMass(W()/2 + padX*1.4, H()/2, 'S', 'B'));

    spawnBall();
    STATE.started = true;
    STATE.noOpponentHitShots = 0;
    STATE.opponentHitThisTurn = false;
    updateUI();
  }

  function newMass(x,y,size, owner){
    return {x,y,size, owner, r:CONF.massR[size], m:CONF.massM[size], color: size==='S'? '#a78bfa' : size==='M'? '#60a5fa' : '#22d3ee'}
  }

  function spawnBall(){
    const s = STATE.turn==='A'? CONF.spawnA : CONF.spawnB;
    const x = s.x*W(), y = s.y*H();
    STATE.ball = {x,y, vx:0, vy:0, moving:false, captured:false};
  }

  // --- UI --------------------------------------------------------------------
  function updateUI(){
    ui.sA.textContent = STATE.scores.A;
    ui.sB.textContent = STATE.scores.B;
    ui.turn.textContent = STATE.turn==='A'? I18N.t('playerA') : I18N.t('playerB');
    ui.moveBtn.disabled = !(STATE.bonusMove || STATE.allowGraviMove[STATE.turn]);
    if(STATE.mode==='shoot'){
      ui.shootBtn.classList.add('primary');
      ui.moveBtn.classList.remove('primary');
    }else{
      ui.moveBtn.classList.add('primary');
      ui.shootBtn.classList.remove('primary');
    }
  }

  ui.resetBtn.onclick = resetGame;
  ui.shootBtn.onclick = ()=>{ STATE.mode='shoot'; updateUI(); };
  ui.moveBtn.onclick = ()=>{ if(!STATE.allowGraviMove[STATE.turn]) return; STATE.mode='move'; updateUI(); };
  // Kielen vaihto (dropdown)
  const langSelect = document.getElementById('langSelect');
  if(langSelect){
    langSelect.value = I18N.getLang();
    langSelect.addEventListener('change', ()=>{
      const lang = langSelect.value;
      I18N.setLang(lang);
      updateUI();
    });
  }

  // --- Piirto ---------------------------------------------------------------
  function draw(){
    ctx.clearRect(0,0,W(),H());

    // Tausta – himmeä ruudukko
    drawGrid();

    // Taskut
    ctx.fillStyle = '#0b0b0b';
    STATE.goals.forEach(g=>{ ctx.beginPath(); ctx.arc(g.x,g.y, CONF.pocketR, 0, Math.PI*2); ctx.fill(); })

    // Kaivot: radial gradient jokaiselle massalle
    STATE.masses.forEach(ms=>drawWell(ms));

    // Keskiviiva (pysty)
    ctx.strokeStyle = '#2a3442'; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(W()/2, 0); ctx.lineTo(W()/2, H()); ctx.stroke(); ctx.setLineDash([]);

    // Massat kiinteinä kiekkoina
    STATE.masses.forEach(ms=>{
      ctx.fillStyle = ms.color;
      ctx.beginPath(); ctx.arc(ms.x, ms.y, ms.r, 0, Math.PI*2); ctx.fill();
      // Korosta siirrettävät massat siirtotilassa hitaalla välkkeellä
      const canMoveNow = STATE.mode==='move' && (STATE.bonusMove || STATE.allowGraviMove[STATE.turn]) && (ms.owner===STATE.turn);
      if(canMoveNow){
        const w = 2*Math.PI/1000; // ~1 Hz
        const alpha = 0.35 + 0.35*(0.5 + 0.5*Math.sin(timeNow*w)); // 0.35–0.70
        ctx.fillStyle = `rgba(255, 196, 0, ${alpha})`;
        ctx.beginPath(); ctx.arc(ms.x, ms.y, ms.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth=2; ctx.stroke();
      // omistajamerkki
      ctx.fillStyle = '#0b1016';
      ctx.font = 'bold 12px system-ui';
      const label = ms.owner==='A'?'A': ms.owner==='B'?'B':'N';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(label, ms.x, ms.y);
    });

    // Pallo
    if(STATE.ball && !STATE.ball.captured){
      ctx.fillStyle = '#e6edf3';
      ctx.beginPath(); ctx.arc(STATE.ball.x, STATE.ball.y, CONF.ballR, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth=2; ctx.stroke();
    }

    // Aloitusalueet visuaalisesti
    drawSpawnZones();

    // Jos käyttäjä tähtää – piirrä vektorinuoli
    if(aiming.active){ drawAim(); }
  }

  function drawGrid(){
    const step = 40;
    ctx.strokeStyle = '#17202b';
    ctx.lineWidth = 1;
    for(let x=step; x<W(); x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H()); ctx.stroke(); }
    for(let y=step; y<H(); y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W(),y); ctx.stroke(); }
  }

  function drawWell(ms){
    const grd = ctx.createRadialGradient(ms.x, ms.y, 8, ms.x, ms.y, ms.r*2.1);
    grd.addColorStop(0, 'rgba(74,163,255,0.25)');
    grd.addColorStop(0.5, 'rgba(74,163,255,0.08)');
    grd.addColorStop(1, 'rgba(74,163,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ms.x, ms.y, ms.r*2.1, 0, Math.PI*2); ctx.fill();
  }

  function drawSpawnZones(){
    const a = {x: CONF.spawnA.x*W(), y: CONF.spawnA.y*H()};
    const b = {x: CONF.spawnB.x*W(), y: CONF.spawnB.y*H()};
    ctx.strokeStyle = '#263040';
    ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.arc(a.x, a.y, 26, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- Fysiikka --------------------------------------------------------------
  function step(dt){
    const ball = STATE.ball; if(!ball || ball.captured) return;
    // Summaa kiihtyvyys massoista
    let ax = 0, ay = 0;
    for(const ms of STATE.masses){
      const dx = ball.x - ms.x, dy = ball.y - ms.y;
      const r2 = dx*dx + dy*dy + CONF.soft;
      const inv = 1/Math.pow(r2, 1.5);
      const k = -CONF.G * ms.m; // kohti massaa
      ax += k * dx * inv; // huom. dx = x - xi → negatiivinen k vetää kohti
      ay += k * dy * inv;
    }
    ball.vx += ax*dt; ball.vy += ay*dt;
    ball.x += ball.vx*dt; ball.y += ball.vy*dt;
    ball.vx *= CONF.friction; ball.vy *= CONF.friction;

    // Seinät
    const r = CONF.ballR;
    if(ball.x < r){ ball.x=r; ball.vx = -ball.vx*CONF.wallLoss; }
    if(ball.x > W()-r){ ball.x=W()-r; ball.vx = -ball.vx*CONF.wallLoss; }
    if(ball.y < r){ ball.y=r; ball.vy = -ball.vy*CONF.wallLoss; }
    if(ball.y > H()-r){ ball.y=H()-r; ball.vy = -ball.vy*CONF.wallLoss; }

    // Taskut
    for(const g of STATE.goals){
      if(dist2(ball.x,ball.y,g.x,g.y) < (CONF.pocketR*CONF.pocketR)){
        onPocket();
        return;
      }
    }
    // Massaan putoaminen
    for(const ms of STATE.masses){
      if(dist2(ball.x,ball.y,ms.x,ms.y) < (ms.r*ms.r*0.65)){
        onCaptured(ms);
        return;
      }
    }

    // Liike päättyy, jos hyvin hidas
    if(Math.hypot(ball.vx, ball.vy) < 6e-3){ ball.vx=0; ball.vy=0; ball.moving=false; }
  }

  function onPocket(){
    // piste vastustajan maaliin: pelaaja saa pisteen aina lyödessään vastustajan päätyyn
    if(STATE.turn==='A'){ STATE.scores.A++; } else { STATE.scores.B++; }
    STATE.ball.captured = true;
    endTurn(true);
  }
  function onCaptured(ms){
    STATE.ball.captured = true;
    // Piste lyöjälle, jos osuu vastustajan massaan (ei pisteitä omaan tai neutraaliin)
    if(ms && (ms.owner==='A' || ms.owner==='B')){
      const hitter = STATE.turn;
      if(ms.owner !== hitter){
        STATE.scores[hitter]++;
        // Bonus: yksi erikoissiirto lyöjälle
        STATE.bonusMove = true;
        STATE.mode = 'move';
        STATE.opponentHitThisTurn = true;
        updateUI();
        return; // älä vaihda vuoroa vielä, odota siirto
      } else {
        // Oma massa: vähennä yksi piste
        STATE.scores[hitter]--;
      }
    }
    endTurn(false);
  }

  function endTurn(scored){
    // gravisiirto-oikeus vaihtuu: sallittu vain joka toisella omalla vuorolla
    const me = STATE.turn;
    if(STATE.mode==='move'){
      // Bonus-siirto ei kuluta normaalia gravisiirtorytmiä
      if(!STATE.wasBonusMove){
        STATE.allowGraviMove[me] = false;
      }
    }
    else {
      // Lyöntivuoron jälkeen palautetaan oikeus, jos edellinen oma vuoro oli siirto
      if(!STATE.allowGraviMove[me]) STATE.allowGraviMove[me] = true; // palautuu käytännössä joka toisen vuoron rytmissä
    }
    // Päivitä "ei osumaa vastustajaan" -laskuri lyöntivuoron päättyessä
    if(!STATE.wasBonusMove){ // lasketaan vain lyöntivuoro, ei bonus-siirtoa
      if(STATE.opponentHitThisTurn){
        STATE.noOpponentHitShots = 0;
      } else {
        STATE.noOpponentHitShots++;
      }
      STATE.opponentHitThisTurn = false;
    }
    // Päättyykö peli kolmen peräkkäisen "ei osuttu vastustajaan" -lyönnin jälkeen?
    if(STATE.noOpponentHitShots >= 3){
      alert(I18N.t('endNoHits'));
      resetGame(); return;
    }
    // Voitto?
    if(STATE.scores.A>=CONF.targetScore || STATE.scores.B>=CONF.targetScore){
      const winner = STATE.scores.A>STATE.scores.B ? I18N.t('playerA') : I18N.t('playerB');
      alert(I18N.t('win', winner));
      resetGame(); return;
    }
    // Vaihda pelaaja ja palauta tila lyöntiin
    STATE.turn = (STATE.turn==='A')? 'B':'A';
    STATE.mode = 'shoot';
    STATE.wasBonusMove = false;
    spawnBall();
    updateUI();
  }

  // --- Syöte: tähtäys & gravisiirto -----------------------------------------
  const aiming = {active:false, sx:0, sy:0, ex:0, ey:0};
  let draggingMass = null; let massStart = null;

  canvas.addEventListener('mousedown', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width/rect.width);
    const y = (e.clientY - rect.top) * (canvas.height/rect.height);

    if(STATE.mode==='move'){
      // etsi lähin oma massa
      if(!(STATE.bonusMove || STATE.allowGraviMove[STATE.turn])) return;
      const own = STATE.masses.filter(m=>m.owner===STATE.turn);
      let best=null, bestD=1e9; for(const m of own){ const d=Math.hypot(x-m.x,y-m.y); if(d<bestD && d<m.r+18){ best=m; bestD=d; } }
      if(best){ draggingMass=best; massStart={x:best.x,y:best.y}; }
    }else{
      // Tähtäys sallittu vain aloitusympyrässä
      const s = STATE.turn==='A'? CONF.spawnA:CONF.spawnB;
      const cx = s.x*W(), cy=s.y*H();
      if(Math.hypot(x-cx,y-cy) <= 28){
        aiming.active=true; aiming.sx=cx; aiming.sy=cy; aiming.ex=x; aiming.ey=y;
      }
    }
  });

  canvas.addEventListener('mousemove',(e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width/rect.width);
    const y = (e.clientY - rect.top) * (canvas.height/rect.height);

    if(aiming.active){ aiming.ex=x; aiming.ey=y; }
    if(draggingMass){
      // rajoita maksimietäisyys
      const dx = x-massStart.x, dy = y-massStart.y; const d=Math.hypot(dx,dy);
      const max = STATE.bonusMove ? (draggingMass.r*6) : CONF.graviStepMax; // bonus: 3x halkaisija
      const f = d>max? max/d : 1;
      let nx = massStart.x + dx*f, ny = massStart.y + dy*f;
      // Ei pysty-keskiviivan yli
      if(draggingMass.owner==='A' && nx>W()/2 - 6) nx = W()/2 - 6;
      if(draggingMass.owner==='B' && nx<W()/2 + 6) nx = W()/2 + 6;
      // Pidä sisällä
      const margin = 42; nx=clamp(nx, margin, W()-margin); ny=clamp(ny, margin, H()-margin);
      draggingMass.x = nx; draggingMass.y = ny;
    }
  });

  window.addEventListener('mouseup', ()=>{
    if(aiming.active){
      // Laukaise
      const dx = aiming.sx - aiming.ex; // vedon suunta (slingshot)
      const dy = aiming.sy - aiming.ey;
      const power = clamp(Math.hypot(dx,dy), 0, 180);
      const scl = 0.04; // nopeuskerroin (2x aiempaan verrattuna)
      STATE.ball.x = aiming.sx; STATE.ball.y = aiming.sy;
      STATE.ball.vx = dx * scl; STATE.ball.vy = dy * scl;
      STATE.ball.moving = true;
      aiming.active=false;
      updateUI();
    }
    if(draggingMass){
      const usedBonus = STATE.bonusMove;
      draggingMass=null;
      if(usedBonus){ STATE.bonusMove=false; STATE.wasBonusMove=true; }
      endTurn(false);
    }
  });

  function drawAim(){
    const {sx,sy,ex,ey} = aiming; const dx = sx-ex, dy=sy-ey; const L = clamp(Math.hypot(dx,dy),0,180);
    const nx = sx - (dx/L)*L, ny = sy - (dy/L)*L;
    ctx.strokeStyle = '#7ee787'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(nx,ny); ctx.stroke();
    // nuolenkärki
    const ang = Math.atan2(dy,dx);
    const hx = nx + Math.cos(ang+Math.PI*0.85)*10;
    const hy = ny + Math.sin(ang+Math.PI*0.85)*10;
    const hx2 = nx + Math.cos(ang-Math.PI*0.85)*10;
    const hy2 = ny + Math.sin(ang-Math.PI*0.85)*10;
    ctx.beginPath(); ctx.moveTo(nx,ny); ctx.lineTo(hx,hy); ctx.lineTo(hx2,hy2); ctx.closePath(); ctx.fillStyle='#7ee787'; ctx.fill();
  }

  // --- Silmukka --------------------------------------------------------------
  let last=performance.now();
  let timeNow=last;
  function loop(now){
    const dt = Math.min(32, now-last)/16; last=now; // ~60 fps normaali
    timeNow = now;
    // simulaatio liikkuu vain jos pallo on elossa
    if(STATE.ball && !STATE.ball.captured && (STATE.ball.moving || Math.hypot(STATE.ball.vx,STATE.ball.vy)>1e-4))
      step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Responssiivisuus
  function fit(){
    const main = canvas.parentElement.getBoundingClientRect();
    // Pidä kuvasuhde 25:16
    const target = 25/16; let w = main.width - 4, h = main.height - 4;
    const ar = w/h; if(ar>target){ w = h*target; } else { h = w/target; }
    canvas.width = Math.round(w); canvas.height = Math.round(h);
    // Päivitä taskut uusien mittojen mukaan
    STATE.goals = [ {x:40,y:40}, {x:canvas.width-40,y:40}, {x:40,y:canvas.height-40}, {x:canvas.width-40,y:canvas.height-40} ];
  }
  new ResizeObserver(fit).observe(canvas.parentElement);

  // --- Käynnistys ------------------------------------------------------------
  resetGame();
  requestAnimationFrame(loop);
