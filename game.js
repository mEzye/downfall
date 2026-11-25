/* DOWNFALL. Original procedural pixel art and Web Audio sound design. No runtime dependencies. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d', { alpha:false });
const foregroundCanvas=$('title-foreground'),foregroundCtx=foregroundCanvas.getContext('2d');
const TAU = Math.PI * 2, clamp = (n,a,b) => Math.max(a,Math.min(b,n)), rand = (a,b) => a+Math.random()*(b-a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const content=window.DownfallContent;
const balance=content.balance;
let W=960,H=540,dpr=1,state='title',time=0,last=0,cam=0,shake=0,flash=0,hitstop=0,toastTimer=0,count=0;
let entities=[],particles=[],labels=[],trails=[],generated=0,seed=0,run=null,player=null,upgradeChoices=[],pendingUpgrade=false;
let menuSelection=0,keys=new Set(),heldTouch=new Set(),hintStarted=-1,hudClock=0,quality=1,frameCosts=[],perfVisible=false;
let best=0,muted=false;
try { best=Number(localStorage.getItem('downfall-best-v2'))||0; muted=localStorage.getItem('downfall-muted')==='true'; } catch {}
$('title-best').textContent=best+' м';
const palettes=[
 {name:'ЗАТОНУЛИЙ ХРАМ',layer:'ШАР I',bg:'#091e25',column:'#0c252d',back:'#102c33',shadow:'#091c23',rock:'#1d3c40',light:'#34564f',edge:'#668375',moss:'#59806a',accent:'#99d6b1',fog:'#183f40'},
 {name:'ГРИБНЕ СЕРЦЕ',layer:'ШАР II',bg:'#17192d',column:'#1e2036',back:'#25283e',shadow:'#121424',rock:'#373b51',light:'#4b5264',edge:'#7a8190',moss:'#8e839b',accent:'#cf9ce3',fog:'#383450'},
 {name:'ВУГІЛЬНА БЕЗОДНЯ',layer:'ШАР III',bg:'#291a24',column:'#322029',back:'#39272e',shadow:'#22151c',rock:'#503332',light:'#704a40',edge:'#aa7860',moss:'#b47f51',accent:'#f2aa6c',fog:'#58332b'}
];
let biome=0,pal=palettes[0],backCache=null,wallCache=null,glows={};
let effects=[],coachTimer=0,grazeTimer=0;
let selectedLevel=0,startingLevel=0,completedBosses=0,devUnlock=false,titleTransition=null;
let titleScroll=0;
const titleCrossingDuration=1.25;
const titleIdleSpeed=34;
const titleFarSpeed=.54;
const titleWallSpeed=.98;
try { completedBosses=Number(localStorage.getItem('downfall-bosses-v1'))||0; } catch {}
function isUnlocked(i){return i===0||!!(completedBosses & (1<<(i-1)));}
function updateLevelMenu(){
 $('levels').innerHTML=palettes.map((p,i)=>`<button type="button" data-level="${i}" class="level-button${i===selectedLevel?' selected':''}" aria-pressed="${i===selectedLevel}" aria-label="${p.name}${!isUnlocked(i)&&!devUnlock?' — заблоковано':''}"><span>${i+1}</span>${!isUnlocked(i)&&!devUnlock?' 🔒':''}</button>`).join('');
 $('level-requirement').textContent=!isUnlocked(1)&&!devUnlock?'II: переможи Дзвонаря':!isUnlocked(2)&&!devUnlock?'III: переможи Спорову Матір':palettes[selectedLevel].name;
 document.querySelector('.title-place span:last-child').innerHTML=palettes[selectedLevel].name+'<small>'+palettes[selectedLevel].layer+'</small>';
 $('dev-unlock').textContent=devUnlock?'Повернути блокування':'Розблокувати всі рівні';$('dev-unlock').setAttribute('aria-pressed',String(devUnlock));
}
function selectLevel(i){
 if(i<0||i>2||i===selectedLevel||(!devUnlock&&!isUnlocked(i)))return;
 selectedLevel=i;
 if(!titleTransition)changeTitleBiome();
 updateLevelMenu();
 audio.event('level-select');
}
function changeTitleBiome(){
 if(biome===selectedLevel)return;
 const outgoing={biome,pal,backCache,wallCache};
 biome=selectedLevel;pal=palettes[biome];buildScenery();
 titleTransition=reduced?null:{outgoing,start:time,scrollStart:titleScroll,distance:H*2.25+200};
 if(titleTransition)audio.wallPass(titleCrossingDuration);
}

// A restrained procedural score: wind, a sub drone, staggered minor arpeggios,
// and short, event-specific transients. All voices have finite envelopes.
const audio={ctx:null,master:null,music:null,wind:null,next:0,step:0,active:0,theme:'',noiseBuffer:null,
 init(){
  if(this.ctx){if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{});return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{
   this.ctx=new AC();const a=this.ctx;a.addEventListener('statechange',updateSoundButton);
   this.master=a.createGain();this.master.gain.value=muted?0:.65;
   const compressor=a.createDynamicsCompressor();compressor.threshold.value=-20;compressor.ratio.value=5;compressor.knee.value=15;
   this.master.connect(compressor);compressor.connect(a.destination);
   this.music=a.createGain();this.music.gain.value=.33;this.music.connect(this.master);
   const delay=a.createDelay(.8),feedback=a.createGain(),wet=a.createGain();delay.delayTime.value=.28;feedback.gain.value=.23;wet.gain.value=.14;this.music.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(this.master);
   this.noiseBuffer=a.createBuffer(1,a.sampleRate,a.sampleRate);const white=this.noiseBuffer.getChannelData(0);for(let i=0;i<white.length;i++)white[i]=rand(-1,1);
   const b=a.createBuffer(1,a.sampleRate*3,a.sampleRate),d=b.getChannelData(0);let brown=0;
   for(let i=0;i<d.length;i++){brown=(brown+rand(-.025,.025))*.99;d[i]=brown;}
   const noise=a.createBufferSource();noise.buffer=b;noise.loop=true;
   const filter=a.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1000;
   this.wind=a.createGain();this.wind.gain.value=.12;noise.connect(filter);filter.connect(this.wind);this.wind.connect(this.music);noise.start();
   [55,82.4069,110.15].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=f;g.gain.value=[.12,.04,.025][i];o.connect(g);g.connect(this.music);o.start();});
   this.next=a.currentTime+.3;
  }catch{this.ctx=null;this.master=null;}
 },
 tone(f,d=.15,type='sine',vol=.1,to=0,delay=0,musical=false){
  if(!this.ctx||muted||this.active>44)return;const a=this.ctx,t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();this.active++;
  o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(15,to),t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,vol),t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(musical?this.music:this.master);o.start(t);o.stop(t+d+.015);o.onended=()=>{o.disconnect();g.disconnect();this.active--;};
 },
 noise(d=.15,vol=.1,f=1700){
  if(!this.ctx||muted||this.active>44)return;const a=this.ctx,t=a.currentTime;
  const s=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();s.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.value=f;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(filter);filter.connect(g);g.connect(this.master);this.active++;s.start(t,0,Math.min(d,.95));s.onended=()=>{s.disconnect();filter.disconnect();g.disconnect();this.active--;};
 },
 wallPass(duration){
  if(!this.ctx||muted||this.active>=44)return;
  const context=this.ctx;
  const start=context.currentTime+duration*.12;
  const nearest=context.currentTime+duration*.43;
  const end=context.currentTime+duration*.94;
  const air=context.createBufferSource();
  const filter=context.createBiquadFilter();
  const gain=context.createGain();
  air.buffer=this.noiseBuffer;
  air.loop=true;
  filter.type='lowpass';
  filter.frequency.value=560;
  filter.Q.value=.15;
  gain.gain.setValueAtTime(.001,start);
  gain.gain.linearRampToValueAtTime(.075,nearest);
  gain.gain.linearRampToValueAtTime(.04,nearest+duration*.17);
  gain.gain.exponentialRampToValueAtTime(.001,end);
  air.connect(filter);filter.connect(gain);gain.connect(this.master);
  this.active++;
  air.onended=()=>{air.disconnect();filter.disconnect();gain.disconnect();this.active--;};
  air.start(start);air.stop(end);
  this.tone(68,.16,'triangle',.1,56,duration*.40);
  this.tone(48,.22,'triangle',.063,42,duration*.47);
 },
 event(name,n=0){
  if(name==='dash'){this.noise(.16,.14,2600);this.tone(210,.19,'sawtooth',.055,42);}
  if(name==='kill'){this.noise(.13,.16,1400);this.tone(90,.14,'triangle',.2,28);this.tone(330*Math.pow(1.075,Math.min(n,12)),.17,'square',.035,550);}
  if(name==='gem'){this.tone(660*Math.pow(1.059,Math.min(n,10)),.13,'sine',.075,1000);}
  if(name==='hurt'){this.noise(.33,.25,650);this.tone(130,.3,'sawtooth',.12,33);}
  if(name==='near'){this.tone(440,.22,'sine',.06,880);}
  if(name==='empty'){this.tone(85,.08,'triangle',.07,60);}
  if(name==='level-select'){this.noise(.045,.085,1900);this.tone(245,.07,'triangle',.065,140);}
  if(name==='upgrade'){[220,277.18,329.63,440,659.25].forEach((f,i)=>this.tone(f,.7,'sine',.09,0,i*.085));}
  if(name==='select'){[440,659.25,880].forEach((f,i)=>this.tone(f,.25,'triangle',.09,0,i*.08));}
  if(name==='death'){this.tone(165,1.5,'triangle',.15,28);this.noise(.8,.2,650);}
  if(name==='boss'){this.tone(55,1.2,'sawtooth',.13,35);this.noise(.6,.19,700);}
  if(name==='bounce'){[330,494,660].forEach((f,i)=>this.tone(f,.18,'triangle',.095,0,i*.035));this.noise(.07,.065,2200);}
  if(name==='prism'){[880,1175,1568].forEach((f,i)=>this.tone(f,.3,'sine',.055,0,i*.035));}
  if(name==='flow'){this.noise(.3,.1,1800);this.tone(165,.35,'sine',.1,660);}
  if(name==='frost'){this.noise(.16,.065,7000);this.tone(1700,.28,'sine',.04,900);}
  if(name==='lightning'){this.noise(.1,.12,5000);this.tone(70,.12,'sawtooth',.04,25);}
  if(name==='shield'){this.tone(550,.36,'sine',.1,220);this.noise(.14,.08,3400);}
  if(name==='bell'){this.tone(147,.8,'sine',.13);this.tone(440,.55,'sine',.045);}
  if(name==='spores'){this.noise(.2,.08,800);this.tone(277,.3,'triangle',.07,130);}
  if(name==='laser'){this.tone(740,.3,'sawtooth',.04,110);this.noise(.3,.1,3200);}
  if(name==='victory'){[220,277.18,329.63,440,554.37,659.25,880].forEach((f,i)=>this.tone(f,1.2,'triangle',.065,0,i*.12));}
 },
 score(theme){
  const a=this.ctx,c=content.music[theme],midi=n=>440*Math.pow(2,(n-69)/12),s=this.step++,beat=s%16,bar=Math.floor(s/16),root=c.root+c.chords[bar%4],wait=Math.max(0,this.next-a.currentTime);
  if(beat===0){[0,3,7].forEach((n,i)=>this.tone(midi(root+n+12),3.2,'sine',.055,0,wait+i*.025,true));}
  if(beat%4===0)this.tone(midi(root+(beat===8?7:0)),.32,c.boss?'triangle':'sine',.15,0,wait,true);
  if(s%2===0)this.tone(midi(root+12+c.arp[(s/2)%8]),c.boss?.2:.36,'triangle',c.boss?.055:.045,0,wait,true);
  const note=c.lead[(beat+(Math.floor(bar/4)%2)*4)%16];
  if(note>=0&&(theme!=='title'||beat%4===0))this.tone(midi(root+note+12),.25,theme==='grove'?'sine':'triangle',c.boss?.085:.065,0,wait,true);
  // Percussion is synthesized once per scheduled step, never by frame count.
  if(theme!=='title'){
   if(beat%4===0)this.tone(100,.13,'sine',c.boss?.1:.055,33,wait,true);
   if(beat%8===4)this.tone(150,.07,'triangle',.06,85,wait,true);
   if(beat%(c.hat||4)===0)this.tone(5200,.025,'square',.006,3100,wait,true);
  }
 },
 update(){
  if(!this.ctx)return;const a=this.ctx,playing=state==='playing';
  this.music.gain.setTargetAtTime(playing?.4:state==='title'?.27:.07,a.currentTime,.25);
  this.wind.gain.setTargetAtTime(player&&player.dashing>0?.65:playing?.2:.1,a.currentTime,.2);
  const theme=state==='title'?'title':run?.boss?(run.boss.id==='forge'?'heart':run.boss.id==='mother'?'mother':'bell'):['temple','grove','forge'][biome];
  if(this.theme!==theme){this.theme=theme;this.step=0;this.next=a.currentTime+.05;}
  if(!playing&&state!=='title'){this.next=a.currentTime+.1;return;}
  if(this.next<a.currentTime-.1)this.next=a.currentTime;
  let scheduled=0;while(this.next<a.currentTime+.08&&scheduled++<3){this.score(theme);this.next+=60/content.music[theme].bpm/4;}
 }
};

function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function glow(color){if(glows[color])return glows[color];const c=makeCanvas(96,96),g=c.getContext('2d'),gr=g.createRadialGradient(48,48,0,48,48,48);gr.addColorStop(0,color);gr.addColorStop(.2,color+'88');gr.addColorStop(1,color+'00');g.fillStyle=gr;g.fillRect(0,0,96,96);return glows[color]=c;}
function light(x,y,r,color,alpha=.4){ctx.globalAlpha=alpha;ctx.drawImage(glow(color),x-r,y-r,r*2,r*2);ctx.globalAlpha=1;}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
function line(x1,y1,x2,y2,c,width=1){ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(Math.round(x1),Math.round(y1));ctx.lineTo(Math.round(x2),Math.round(y2));ctx.stroke();}
function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();}
function pixelSprite(rows,colors){const c=makeCanvas(Math.max(...rows.map(r=>r.length)),rows.length),g=c.getContext('2d');rows.forEach((r,y)=>[...r].forEach((p,x)=>{if(colors[p]){g.fillStyle=colors[p];g.fillRect(x,y,1,1);}}));return c;}
const sprites={
 hero:pixelSprite([
 '      hhhhh       ','    hhlllllhh     ','   hllllwwlllh    ','   hllwwwwlllh    ','  hllwwwwwwlllh   ','  hllbbbbbblllh   ','  hllbteetblllh   ','   hlbbbbbbllh    ','    hlllclllh     ','   sssccccsss     ','  ssrscddcsr ss   ','  srrcddddcs  s   ','  srcddddddcs     ','   ccddddddcc     ','   ccddddddcc     ','    ccddddcc      ','    ccddddcc      ','    bkbbbbkb      ','   bkkb  bkkb     ','   bkkb  bkkb     ','  bkkkb  bkkkb    ','  bbbbb  bbbbb    '
 ],{h:'#294d50',l:'#d5d9b8',w:'#f4ecd1',b:'#123239',t:'#568f87',e:'#b7fce0',c:'#5c9586',d:'#224e50',s:'#dba669',r:'#f1ca82',k:'#28484b'}),
 moth:pixelSprite([
 ' a             a ',' aa           aa ',' abb         bba ',' abbc   d   cbba ','  abbc ddd cbba  ','  abbccdddc cbba ','   abccdddc cbba ','    bcdeedcbba   ','   abccdddcba    ','  abb cddd bba   ','  ab   ddd  ba   ','   a    d   a    '
 ],{a:'#324e53',b:'#628c83',c:'#9cbba0',d:'#dcc8a1',e:'#ee9e70'}),
 eye:pixelSprite([
 '    aaaaa    ','  aabbbbbaa  ',' abccbbbccba ',' abccdddccba ','abbcdededcbba','abbcdeeedcbba','abbcdededcbba',' abccdddccba ',' abccbbbccba ','  aabbbbbaa  ','    aaaaa    '
 ],{a:'#613d48',b:'#ae665f',c:'#e2947d',d:'#f6d9af',e:'#3c3442'}),
 jelly:pixelSprite([
 '    aaaaa    ','   abbbbba   ','  abbcccbba  ',' abccdddccba ',' abccdddccba ','abcdeeedecbba','abccdddcccbba',' abbbbbbbba  ','  ababababa  ','  a a a a a  ',' a  a a  a   ',' a   a   a   ','  a  a  a    '
 ],{a:'#43536a',b:'#768391',c:'#a2c5bd',d:'#d1ddd2',e:'#253f51'}),
 gem:pixelSprite(['   a   ','  aba  ',' abcca ','abdccca',' adcca ','  aca  ','   a   '],{a:'#ac7c48',b:'#ffe2a2',c:'#e8b76d',d:'#fff4c6'}),
 heart:pixelSprite([' aa aa ','abbbbaa','abbbbaa',' ab bba','  abba ','   aa  '],{a:'#bc6f66',b:'#f1a089'})
};
for(const [kind,rows] of Object.entries(content.spriteRows)){
 const colors=kind==='wisp'||kind==='beetle'||kind==='turret'?{a:'#513942',b:'#a85f4f',c:'#de9868',d:'#f5c88d',e:'#fff0b9',f:'#251c28'}:kind==='sentinel'?{a:'#1c353b',b:'#51746d',c:'#95b49b',d:'#cde3bd',e:'#74e6c8',f:'#253d40'}:{a:'#40334e',b:'#7d6689',c:'#b39cbe',d:'#e3bdcf',e:'#ecc999',f:'#2e2c43'};
 sprites[kind]=pixelSprite(rows,colors);
}

function rng(n){let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function buildScenery(){
 backCache=makeCanvas(W,820);const g=backCache.getContext('2d');g.fillStyle=pal.bg;g.fillRect(0,0,W,820);
 // Distant cut-stone architecture. Repeating vertically without a hard seam.
 for(let layer=0;layer<2;layer++){
  const spacing=layer?145:205,off=layer?62:10;
  g.fillStyle=layer?pal.back:pal.column;
  for(let x=off-60;x<W+80;x+=spacing){g.fillRect(x,0,18,820);g.fillRect(x+29,0,8,820);for(let y=100;y<820;y+=205){g.fillRect(x-15,y,65,9);g.fillRect(x-7,y+9,49,6);g.fillRect(x+18,y+15,8,180);}}
 }
 for(let i=0;i<180;i++){g.fillStyle=i%3?pal.back:pal.light;g.globalAlpha=i%3?.25:.1;g.fillRect(rng(i+1)*W,rng(i+19)*820,2+rng(i+65)*5,2);}g.globalAlpha=1;
 if(biome===1){for(let i=0;i<6;i++){const x=rng(i+3)*W,y=i*136,w=35+rng(i+4)*45;g.fillStyle='#2e2b46';g.fillRect(x-5,y,10,120);g.fillRect(x-w,y,w*2,12);g.fillRect(x-w*.7,y-13,w*1.4,13);g.fillRect(x-w*.35,y-22,w*.7,9);g.fillStyle='#4b3c5f';g.fillRect(x-w+5,y+9,w*2-10,2);}}
 if(biome===2){for(let i=0;i<8;i++){const x=rng(i+17)*W,y=i*103;g.fillStyle='#493032';g.fillRect(x-3,y-45,6,90);g.fillRect(x-45,y-3,90,6);g.fillRect(x-28,y-28,56,56);g.fillStyle='#2c242e';g.fillRect(x-20,y-20,40,40);g.fillRect(x-6,y-6,12,12);}}
 wallCache=makeCanvas(110,768);const a=wallCache.getContext('2d');
 for(let y=0;y<768;y+=16){const edge=58+Math.floor(rng(y+18)*25);a.fillStyle=pal.shadow;a.fillRect(0,y,edge+10,17);a.fillStyle=pal.rock;a.fillRect(0,y,edge,16);a.fillStyle=pal.light;a.fillRect(0,y,edge-2,2);a.fillStyle=pal.back;a.fillRect(edge-5,y+6,5,10);for(let x=4;x<edge-8;x+=15){const r=rng(x+y*17);a.fillStyle=r>.5?pal.light:pal.back;a.fillRect(x,y+3+r*6,5+r*7,3);if(r>.7){a.fillStyle=pal.edge;a.fillRect(x,y+2,5,1);}}if(rng(y)> .55){a.fillStyle=pal.moss;a.fillRect(edge-6,y,7,4);a.fillRect(edge-4,y+4,3,7+rng(y+3)*12);}}
}
function resize(){
 const ratio=innerWidth/Math.max(1,innerHeight);H=Math.round(clamp(innerHeight/2.15,320,540));W=Math.round(H*ratio);
 if(W<280){W=280;H=Math.round(W/ratio);}if(W>1160){W=1160;H=Math.round(W/ratio);}
 canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;dpr=innerWidth/W;
 foregroundCanvas.width=W;foregroundCanvas.height=H;
 if(state==='title'&&titleTransition){titleTransition=null;biome=selectedLevel;pal=palettes[biome];}
 buildScenery();if(player)player.x=clamp(player.x,playerEdge(),W-playerEdge());
}
function playerEdge(){return W<440?58:84;}
function spawnEdge(){return W<440?77:100;}
addEventListener('resize',resize);resize();

const mutations=[
 {id:'fang',icon:'⋔',name:'Ікло прірви',text:'Ривок довший і швидший. +1 шкода ядрам босів.',tag:'РИВОК · АТАКА',apply(){run.fang++;}},
 {id:'magnet',icon:'⟡',name:'Золота орбіта',text:'Уламки притягуються здалеку. Кожні 30 зібраних лікують на 1.',tag:'ЗБІР · ВІДНОВЛЕННЯ',apply(){run.magnet++;}},
 {id:'charge',icon:'ϟ',name:'Другий подих',text:'+1 заряд ривка, до 4. Відновлення швидше на 8%.',tag:'РИВОК · ЕНЕРГІЯ',apply(){run.maxCharges=Math.min(balance.maxCharges,run.maxCharges+1);player.charges=Math.min(run.maxCharges,player.charges+1);run.recharge*=.92;}},
 {id:'orbit',icon:'✦',name:'Зірка-супутник',text:'Навколо тебе обертається лезо. Знищує ворогів і снаряди.',tag:'ЗАХИСТ · ОРБІТА',apply(){run.orbit++;}},
 {id:'focus',icon:'◎',name:'Тихий час',text:'Фокус витрачається на 25% повільніше. Кожне восьме ухилення лікує.',tag:'ФОКУС · УХИЛЕННЯ',apply(){run.focusMod*=.75;run.nearHeal=true;}},
 {id:'shell',icon:'⬡',name:'Кам’яне серце',text:'+1 максимальне здоров’я, до 6. Лікує на 1 серце.',tag:'ЗАХИСТ · ЗДОРОВ’Я',apply(){run.maxHp=Math.min(balance.maxHp,run.maxHp+1);player.hp=Math.min(run.maxHp,player.hp+1);}},
 {id:'nova',icon:'☀',name:'Сонячний уламок',text:'Кожне третє вбивство запускає вибух, що знищує сусідніх ворогів.',tag:'АТАКА · ЛАНЦЮГ',apply(){run.nova++;}},
 {id:'blood',icon:'◇',name:'Жага глибини',text:'Комбо живе вдвічі довше. Кожне дванадцяте вбивство лікує на 1.',tag:'КОМБО · ВІДНОВЛЕННЯ',apply(){run.comboDuration=8;run.vampire=true;}},
 {id:'lightning',icon:'ϟ',name:'Нерв грози',text:'Убивства запускають блискавку в сусіднього ворога. Повторний вибір збільшує дальність.',tag:'БЛИСКАВКА · ЛАНЦЮГ',apply(){run.lightning++;}},
 {id:'frost',icon:'❄',name:'Крижаний слід',text:'Ривок заморожує сусідів на 2 секунди. Заморожені вороги розлітаються крижаними уламками.',tag:'КРИГА · КОНТРОЛЬ',apply(){run.frost++;}},
 {id:'ember',icon:'♨',name:'Живий попіл',text:'Убиті вороги залишають дружній вогонь, що спалює інших потвор.',tag:'ВОГОНЬ · ЗОНА',apply(){run.ember++;}},
 {id:'echo',icon:'⋮',name:'Луна падіння',text:'Після ривка з’являється примарне лезо, яке повторює удар униз.',tag:'ЛУНА · АТАКА',apply(){run.echo++;}},
 {id:'shield',icon:'⬢',name:'Бурштиновий оберіг',text:'Щит поглинає одну атаку й відновлюється кожні 18 секунд.',tag:'ЩИТ · ЗАХИСТ',apply(){run.ward=true;player.ward=true;run.wardTime=0;}},
 {id:'storm',icon:'✺',name:'Іскра ризику',text:'Близьке ухилення випускає три самонавідні іскри в потвор.',tag:'УХИЛЕННЯ · АТАКА',apply(){run.storm++;}},
 {id:'bloom',icon:'✿',name:'Серце грибниці',text:'Кожен п’ятий новий об’єкт для відскоку лікує. Перший відскок випускає дружні спори.',tag:'ВІДСКОК · ЗЦІЛЕННЯ',apply(){run.bloom++;}},
 {id:'rebound',icon:'↯',name:'Пружна кров',text:'Відскоки підкидають вище. Удар після відскоку завдає +1 шкоду босу.',tag:'ВІДСКОК · ІМПУЛЬС',apply(){run.rebound++;}},
 {id:'leech',icon:'◈',name:'Пожирач часу',text:'При ударі витрачає 65 фокусу замість здоров’я. Працює, поки вистачає фокусу.',tag:'ФОКУС · ЗАХИСТ',apply(){run.leech=true;}},
 {id:'harvest',icon:'⁕',name:'Золотий дощ',text:'Кожне вбивство залишає додаткові уламки. Підбір частково відновлює ривок.',tag:'ЗДОБИЧ · ЕНЕРГІЯ',apply(){run.harvest++;}}
];
function show(id,visible){$(id).hidden=!visible;}
function setState(next){
 state=next;show('title',next==='title');show('pause',next==='paused');show('upgrade',next==='upgrade');show('end',next==='ended');show('countdown',next==='countdown');
 show('hud',!['title','ended'].includes(next));show('pause-button',['playing','paused','countdown'].includes(next));show('touch',matchMedia('(pointer:coarse)').matches&&next==='playing');
 keys.clear();heldTouch.clear();
}
function reset(level=startingLevel){
 startingLevel=level;audio.init();biome=level;pal=palettes[level];buildScenery();titleTransition=null;
 seed=Math.random()*10000;cam=0;generated=450;entities=[];particles=[];trails=[];labels=[];effects=[];pendingUpgrade=false;shake=0;flash=0;hitstop=0;hintStarted=-1;coachTimer=0;grazeTimer=0;show('coach',false);$('graze-notice').classList.remove('show');document.querySelector('.focus-track').classList.remove('graze');
 run={depth:level*500,deepestY:150,shards:0,collected:0,kills:0,combo:0,comboTime:0,bestCombo:0,maxHp:balance.startHp,maxCharges:balance.startCharges,recharge:balance.recharge,nextGate:level*500+250,fang:0,magnet:0,orbit:0,nova:0,vampire:false,nearHeal:false,nearCount:0,focusMod:1,comboDuration:4,chosen:[],boss:null,won:false,elapsed:0,previousBest:best};
 player={x:W/2,y:150,vx:0,vy:110,hp:balance.startHp,charges:balance.startCharges,chargeTime:0,dashing:0,invuln:.8,focus:65,focusActive:false,scarf:[],lastX:W/2};
 Object.assign(run,{cleared:level,bounces:0,uniqueBounces:0,lightning:0,frost:0,ember:0,echo:0,ward:false,wardTime:0,storm:0,bloom:0,rebound:0,leech:false,harvest:0,taught:{},echoes:0,nearBest:0});
 Object.assign(player,{boost:0,reboundTime:0,ward:false,echoPending:false,prevX:player.x,prevY:player.y});
 // A guaranteed ring introduces an upward rebound before random encounters.
 entities.push({type:'flow',x:W/2+50,y:355,used:false});
 $('hint').style.opacity='1';$('hint').innerHTML=matchMedia('(pointer:coarse)').matches?'‹ › — рух · ↓ — ривок · ◎ — фокус':'<span><kbd>A</kbd> <kbd>D</kbd> рух</span><span><kbd>SPACE</kbd> ривок крізь ворогів</span><span><kbd>SHIFT</kbd> уповільнення</span>';
 setState('playing');toast(pal.name,2.5);generate();updateHUD();
}
function toast(text,d=1.7){$('toast').textContent=text;$('toast').classList.add('show');toastTimer=d;}
function teach(id,text,duration=5){if(run.taught[id]||(coachTimer>1&&!id.startsWith('boss')&&!id.endsWith('done')))return;run.taught[id]=true;$('coach').innerHTML=text;coachTimer=duration;show('coach',true);}
function effect(type,x,y,color='#d6e7c2',radius=40,duration=.5,extra={}){
 if(effects.length>=(quality?60:24))effects.shift();effects.push({type,x,y,color,radius,life:duration,duration,...extra});
}
function shoot(x,y,vx,vy,color='#e9c087',friendly=false,extra={}){
 if(entities.length>180)return;
 entities.push({type:friendly?'friendly':'bullet',x,y,vx,vy,color,age:0,life:extra.life||4,near:false,...extra});
}
function radial(x,y,n,speed,color,friendly=false,offset=0){for(let i=0;i<n;i++){const a=i*TAU/n+offset;shoot(x,y,Math.cos(a)*speed,Math.sin(a)*speed,color,friendly);}}
function detonate(x,y,r,color,source='blast'){
 effect('ring',x,y,color,r,.5);effect('star',x,y,color,r*.55,.35);burst(x,y,color,24,150);
 const victims=entities.filter(e=>e.type==='enemy'&&!e.dead&&Math.hypot(e.x-x,e.y-y)<r);
 for(const e of victims)kill(e,source);
}
function releaseEcho(){
 if(!player.echoPending)return;player.echoPending=false;
 entities.push({type:'echo',x:player.x,y:player.y-35,age:0,life:.9});effect('slash',player.x,player.y-35,'#b1cec8',40,.45);run.echoes++;
}
function kickUp(speed,grace=balance.bounceGrace){
 releaseEcho();player.vy=-speed;player.dashing=0;player.boost=0;player.reboundTime=1.5;
 player.invuln=Math.max(player.invuln,grace);
}
function bounce(e){
 if(e.dead||e.exhausted||e.used||player.vy<=0)return;
 const first=!e.rewarded;e.used=true;e.rewarded=true;e.cooldown=.85;e.bounceUses=(e.bounceUses||0)+1;run.bounces++;
 const color=e.type==='prism'?'#afc8ff':e.type==='flow'?'#9fe8d0':e.type==='rock'?'#bacdb3':'#d4b4ed';
 const speed=e.type==='spring'?balance.springJump:e.type==='prism'?balance.prismJump:e.type==='flow'?balance.flowJump:balance.rockJump;
 player.y=Math.min(player.y,e.y-18);kickUp(speed+Math.min(2,run.rebound)*25);
 if(first){run.uniqueBounces++;player.charges=Math.min(run.maxCharges,player.charges+1);}
 effect('ring',e.x,e.y,color,48,.45);effect('arrows',e.x,e.y,color,45,.5,{up:true});burst(e.x,e.y,color,16,100);shake=Math.max(shake,2.5);hitstop=.02;audio.event(e.type==='flow'?'flow':e.type==='prism'?'prism':'bounce');
 label(player.x,player.y-22,first?'ВІДСКОК ↑ · +ЗАРЯД':'ВІДСКОК ↑',color);
 if(e.bounceUses>=balance.objectBounces){e.exhausted=true;e.dead=true;burst(e.x,e.y,color,20,85);effect('star',e.x,e.y,color,32,.4);}
 if(first&&e.type==='prism')for(let i=-1;i<=1;i++)shoot(e.x,e.y,i*95,220,'#bad4ff',true,{life:1.2});
 if(first&&run.bloom){radial(e.x,e.y,6,130,'#d4b4ed',true);if(run.uniqueBounces%balance.bloomHealEvery===0)heal();}
 teach('steer','<b>Відскок підкидає вгору.</b> A / D — рух у повітрі. Об’єкт витримує 3 відскоки; заряд — лише за перший.',5);
}
function burst(x,y,color,n=16,force=80){
 const limit=quality?350:140;
 for(let i=0;i<n&&particles.length<limit;i++){const a=rand(0,TAU),s=rand(force*.15,force);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.75),max:.75,color,size:Math.random()>.7?3:2});}
}
function label(x,y,text,color='#f4d9a0'){if(labels.length<12)labels.push({x,y,text,color,life:1.1});}
function generate(){
 if(!player||run.boss)return;
 while(generated<player.y+H+350){
  const edge=spawnEdge(),y=generated,depth=run.depth+Math.max(0,y-run.deepestY)/balance.worldUnitsPerMeter,difficulty=Math.min(4,depth/350),lane=rand(edge,W-edge),kind=Math.random();
  const bossDepth=content.bosses[run.cleared]?.depth||Infinity;
  if(Math.abs(depth-run.nextGate)>6&&Math.abs(depth-bossDepth)>10){
   const count=1+Math.floor(rand(0,1+difficulty*.6));
   for(let i=0;i<count;i++){
    const x=clamp(lane+(i-count/2)*70,edge-10,W-edge+10);
    const pool=content.enemies[biome],enemyKind=pool[Math.floor(Math.random()*pool.length)];
    entities.push({type:'enemy',kind:enemyKind,x,y:y+i*40,baseX:x,t:rand(0,TAU),hp:1,near:false,shot:rand(.55,1.3),frozen:0});
   }
   if(kind>.53){const left=Math.random()>.5,width=rand(35,Math.max(45,W*.2)),wall=playerEdge()-12;entities.push({type:'spikes',x:left?wall:W-wall-width,y:y+85,w:width,h:15,near:false});}
   if(kind<.32&&depth>80){const x=rand(edge,W-edge-35);entities.push({type:'rock',x,y:y+100,w:rand(35,55),h:15,near:false});}
   for(let i=0;i<5;i++)entities.push({type:'gem',x:clamp(lane+Math.sin(i*.7)*30,edge-5,W-edge+5),y:y+55+i*20,t:i*.7});
   if(Math.random()<balance.healDropChance)entities.push({type:'heal',x:rand(edge,W-edge),y:y+150});
   run.segments=(run.segments||0)+1;
   if(run.segments%2===0){
    const types=biome===1?['spring','spring','prism']:biome===2?['flow','prism','flow']:['prism','flow','spring'],type=types[Math.floor(run.segments/2)%3],bx=clamp(lane+(lane<W/2?45:-45),edge,W-edge);
    entities.push({type,x:bx,y:y+155,dir:bx<W/2?1:-1,used:false});
   }
   if(kind<.28&&depth>130){
    if(biome===0&&depth>220)entities.push({type:'beam',x:rand(edge,W-edge),y:y-60,h:260,w:13,age:0,warn:1.4,life:2,color:'#a6e2d0',dormant:true});
    if(biome===1)entities.push({type:'cloud',x:rand(edge,W-edge),y:y+100,r:27,age:0,life:8,color:'#c39dd6',dormant:true});
    if(biome===2)entities.push({type:'mine',x:rand(edge,W-edge),y:y+100,r:12,age:0,life:9,color:'#f2a073',dormant:true});
   }
  }
  generated+=rand(190,280)-difficulty*12;
 }
}
function dash(){
 if(state!=='playing'||player.dashing>0)return;
 if(hintStarted<0)hintStarted=run.elapsed;
 if(player.charges<=0){audio.event('empty');return;}
 if(player.charges===run.maxCharges)player.chargeTime=0;
 player.charges--;player.dashing=balance.dashDuration+Math.min(2,run.fang)*balance.fangDuration;player.vy=balance.dashSpeed+Math.min(2,run.fang)*balance.fangSpeed;
 player.echoPending=run.echo>0;effect('slash',player.x,player.y,'#f6d8a0',35,.25);
 shake=Math.max(shake,2);audio.event('dash');burst(player.x,player.y,'#d7e5bc',10,60);
}
function kill(e,source='dash'){
 if(e.dead)return;e.dead=true;run.kills++;run.combo++;run.comboTime=run.comboDuration;run.bestCombo=Math.max(run.bestCombo,run.combo);
 const multi=1+Math.floor(run.combo/5);run.shards+=2*multi;
 if(source==='dash')player.charges=Math.min(run.maxCharges,player.charges+1);
 player.focus=clamp(player.focus+balance.focusOnKill,0,100);const color=e.frozen>0?'#bbdeff':biome===1?'#dab2e6':'#f1c583';burst(e.x,e.y,color,20,125);burst(e.x,e.y,'#9bcbbb',8,85);effect('slash',e.x,e.y,color,32,.26);
 shake=Math.max(shake,Math.min(7,2+run.combo*.3));hitstop=.035;audio.event('kill',run.combo);label(e.x,e.y-15,run.combo>1?'×'+run.combo:'+'+2*multi);
 if(run.vampire&&run.kills%balance.vampireHealEvery===0)heal();
 if(run.nova&&run.kills%3===0&&source!=='nova'){
  detonate(e.x,e.y,70+run.nova*15,'#ffdf9d','nova');
 }
 if(e.frozen>0){audio.event('frost');effect('star',e.x,e.y,'#b9e4ff',40,.4);for(let i=-1;i<=1;i++)shoot(e.x,e.y,i*95,190,'#b9e4ff',true,{life:1});}
 if(e.kind==='spore'){radial(e.x,e.y,6,65,'#caa5db',false,.3);effect('ring',e.x,e.y,'#caa5db',32,.4);}
 if(run.ember&&entities.length<160)entities.push({type:'flame',x:e.x,y:e.y,r:24+run.ember*6,life:2,age:0});
 if(run.lightning&&source!=='lightning'){
  const target=entities.find(o=>o.type==='enemy'&&!o.dead&&Math.hypot(o.x-e.x,o.y-e.y)<80+run.lightning*25);
  if(target){effect('lightning',e.x,e.y,'#b6dfff',40,.28,{tx:target.x,ty:target.y});audio.event('lightning');kill(target,'lightning');}
 }
 if(run.harvest)for(let i=0;i<2+run.harvest;i++)entities.push({type:'gem',x:e.x+rand(-14,14),y:e.y+rand(-5,20),t:i});
}
function heal(){if(player.hp<run.maxHp){player.hp++;label(player.x,player.y-25,'+1 ♥','#a8e0b9');audio.event('gem');}}
function hurt(piercesDash=false){
 if(player.invuln>0||(player.dashing>0&&!piercesDash))return;
 if(player.ward){player.ward=false;run.wardTime=0;player.invuln=.4;effect('hex',player.x,player.y,'#f6d39a',65,.5);audio.event('shield');label(player.x,player.y-25,'ЩИТ');return;}
 if(run.leech&&player.focus>=balance.leechCost){player.focus-=balance.leechCost;player.invuln=.4;effect('ring',player.x,player.y,'#bce8df',55,.45);audio.event('shield');label(player.x,player.y-25,'−65 ФОКУСУ','#bce8df');return;}
 releaseEcho();player.dashing=0;player.vy=Math.min(player.vy,balance.fallSpeed);
 player.hp--;player.invuln=balance.hurtGrace;run.combo=0;run.comboTime=0;shake=9;flash=.3;hitstop=.07;audio.event('hurt');burst(player.x,player.y,'#ed8c7a',24,150);
 if(player.hp<=0)end(false);
}
function near(e,d,hit=false){
 if(e.near||e.dead)return;
 const radius=e.type==='bullet'?11:20;
 if(hit){e.grazeFailed=true;return;}
 if((player.dashing>0||player.invuln>0)&&d<radius+23&&Math.abs(e.y-player.y)<40){e.grazeFailed=true;return;}
 if(!e.grazeFailed&&d>radius+3&&d<radius+23&&Math.abs(e.y-player.y)<38)e.grazeArmed=true;
 if(e.grazeArmed&&!e.grazeFailed&&e.y<player.y-12){
  e.near=true;player.focus=clamp(player.focus+20,0,100);player.chargeTime+=.35;run.nearCount++;run.nearBest++;
  effect('ring',e.x,e.y,'#a9f2d3',48,.5);effect('link',e.x,e.y,'#a9f2d3',20,.5,{tx:player.x,ty:player.y});label(player.x,player.y-25,'+20 ФОКУСУ','#b7f8da');audio.event('near');
  grazeTimer=1.5;$('graze-notice').classList.add('show');document.querySelector('.focus-track').classList.add('graze');
  if(run.nearHeal&&run.nearCount%balance.nearHealEvery===0)heal();
  if(run.storm){for(let i=-1;i<=1;i++)shoot(player.x,player.y,i*90,220,'#c8edff',true,{homing:true,life:2});audio.event('lightning');}
  teach('graze-done','<b>Ухилення: +20 фокусу.</b> Утримуй Shift, щоб сповільнити небезпеки.',5);
 }
}
function enterUpgrade(){
 pendingUpgrade=false;player.charges=Math.min(run.maxCharges,player.charges+1);player.focus=clamp(player.focus+balance.upgradeFocus,0,100);
 const single=new Set(['blood','shield','leech','bloom','storm','echo']);
 const pool=mutations.filter(m=>(m.id!=='shell'||run.maxHp<balance.maxHp)&&(m.id!=='charge'||run.maxCharges<balance.maxCharges)&&(m.id!=='fang'||run.fang<2)&&(m.id!=='orbit'||run.orbit<2)&&(!single.has(m.id)||!run.chosen.some(c=>c.id===m.id)));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}upgradeChoices=pool.slice(0,3);
 $('upgrade-cards').innerHTML=upgradeChoices.map((m,i)=>`<button class="upgrade-card" data-choice="${i}"><span class="choice-num">0${i+1}</span><span class="relic-icon">${m.icon}</span><h3>${m.name}</h3><p>${m.text}</p><span class="tag">${m.tag}</span></button>`).join('');
 setState('upgrade');audio.event('upgrade');$('upgrade-cards').querySelector('button').focus({preventScroll:true});
}
function choose(i){
 if(state!=='upgrade'||!upgradeChoices[i])return;const m=upgradeChoices[i];m.apply();run.chosen.push(m);run.nextGate+=250;
 audio.event('select');startCountdown(1.5);toast(m.name,2);updateHUD();
}
function startCountdown(duration=3){count=duration;setState('countdown');$('countdown').textContent=Math.ceil(count);}
function pause(){if(state==='playing'||state==='countdown'){setState('paused');$('resume').focus({preventScroll:true});}}
function end(won){
 run.won=won;best=Math.max(best,Math.floor(run.depth));try{localStorage.setItem('downfall-best-v2',best);}catch{}
 $('end-eyebrow').textContent=won?'СЕРЦЕ ПРІРВИ ЗНИЩЕНО':'ПРІРВА ЗАБРАЛА СВОЄ';$('end-title').textContent=won?'Ти дістався серця.':'Ще одне падіння.';
 $('end-depth').textContent=Math.floor(run.depth);$('end-kills').textContent=run.kills;$('end-shards').textContent=run.shards;$('end-combo').textContent='×'+run.bestCombo;$('end-bounces').textContent=run.bounces;$('end-bosses').textContent=run.cleared+'/3';
 $('end-record').textContent=run.depth>run.previousBest?'НОВА НАЙКРАЩА ГЛИБИНА':'РЕКОРД: '+best+' М';$('title-best').textContent=best+' м';setState('ended');audio.event(won?'upgrade':'death');$('again').focus({preventScroll:true});
}
function beginBoss(){
 const def=content.bosses[run.cleared];if(!def)return;
 run.depth=def.depth;run.boss={...def,x:W/2,y:player.y+115,hp:def.hp,maxHp:def.hp,t:0,shot:1.7,hurt:0,phase:1,attackIndex:0,attack:null};
 entities=entities.filter(e=>e.type==='gem');toast(def.name,3);audio.event('boss');player.charges=Math.min(run.maxCharges,player.charges+1);player.focus=clamp(player.focus+15,0,100);player.invuln=Math.max(player.invuln,.8);
 effect('ring',W/2,player.y+155,def.color,120,1);teach('boss-'+def.id,def.subtitle,7);updateHUD();
 $('hint').style.opacity='0';hintStarted=run.elapsed-8;
}
const attackNames={peal:'ПРИЦІЛЬНИЙ ПЕРЕДЗВІН',columns:'ЗВУКОВІ СТОВПИ',resonance:'КІЛЬЦЕ РЕЗОНАНСУ',spores:'СПОРОВА СПІРАЛЬ',seeds:'ОТРУЙНЕ НАСІННЯ',brood:'ПОКЛИК ЗГРАЇ',lances:'ПРИЦІЛЬНІ ПРОМЕНІ',firewall:'ВОГНЯНИЙ ЗАСЛІН',spiral:'СПІРАЛЬ ЖАРУ',meteors:'МЕТЕОРНИЙ ДОЩ'};
function prepareAttack(b){
 const kind=b.attacks[b.attackIndex++%b.attacks.length],warn=b.phase===2?.75:1;
 b.attack={kind,timer:warn,targetX:player.x};
 if(kind==='columns'||kind==='lances'){
  const n=kind==='columns'?(b.phase===2?3:2):2;
  for(let i=0;i<n;i++){
   const x=kind==='lances'?clamp(player.x+(i?52:-52),playerEdge()+12,W-playerEdge()-12):playerEdge()+25+(W-2*playerEdge()-50)*(i+.4)/n;
   entities.push({type:'beam',x,y:player.y-H*.3,h:H*1.7,w:kind==='lances'?18:13,age:0,warn,life:warn+.42,color:b.color});
  }
 }
 if(kind==='seeds')for(let i=0;i<3;i++)entities.push({type:'bomb',x:clamp(player.x+(i-1)*85,spawnEdge()-10,W-spawnEdge()+10),y:player.y+130+i%2*40,age:0,warn:1.2,life:1.3,color:b.color});
 if(kind==='firewall'){const gapWidth=W<440?72:105;entities.push({type:'wave',x:playerEdge(),y:b.y+45,w:W-2*playerEdge(),gap:clamp(player.x+(player.x<W/2?50:-50),playerEdge()+gapWidth/2+10,W-playerEdge()-gapWidth/2-10),gapWidth,vy:-100,age:0,warn:.85,life:4,color:b.color});}
 audio.event(b.id==='bell'?'bell':b.id==='mother'?'spores':'boss');
}
function fireAttack(b){
 const kind=b.attack.kind,targetX=b.attack.targetX,color=b.color,aim=Math.atan2(player.y-b.y,targetX-b.x);
 if(kind==='peal')for(let i=-1-b.phase+1;i<=b.phase;i++)shoot(b.x,b.y-25,Math.cos(aim+i*.18)*115,Math.sin(aim+i*.18)*115,color);
 if(kind==='resonance'){radial(b.x,b.y,8+b.phase*2,100,color,false,b.t);effect('ring',b.x,b.y,color,105,.7);}
 if(kind==='spores'||kind==='spiral'){
  const n=b.phase===2?12:8;for(let i=0;i<n;i++){const a=-Math.PI+i*TAU/n+b.t*.4;shoot(b.x,b.y,Math.cos(a)*105,Math.sin(a)*105,color,false,{curve:kind==='spiral'?.6:0});}
 }
 if(kind==='brood')for(let i=0;i<2+b.phase;i++){const x=clamp(b.x+(i-1)*45,spawnEdge(),W-spawnEdge());entities.push({type:'enemy',kind:'spore',x,y:b.y-15,baseX:x,t:i,shot:2,frozen:0,near:false});}
 if(kind==='meteors')for(let i=0;i<4+b.phase;i++)shoot(rand(spawnEdge(),W-spawnEdge()),player.y-100,rand(-55,55),265,'#ffbc7f',false,{meteor:true,life:2.4});
 if(kind==='columns'||kind==='lances')audio.event('laser');
 effect('star',b.x,b.y,color,65,.4);b.attack=null;b.shot=b.phase===2?.85:1.2;
}
function defeatBoss(){
 const b=run.boss;detonate(b.x,b.y,150,b.color,'boss');effect('ring',b.x,b.y,b.color,230,1.1);audio.event('victory');shake=12;player.invuln=1;player.charges=Math.min(run.maxCharges,player.charges+1);player.focus=clamp(player.focus+20,0,100);player.hp=Math.min(run.maxHp,player.hp+balance.bossRewardHeal);run.shards+=35;
 run.cleared++;if(b.id==='bell'||b.id==='mother'){completedBosses|=b.id==='bell'?1:2;try{localStorage.setItem('downfall-bosses-v1',String(completedBosses));}catch{}updateLevelMenu();}run.boss=null;run.deepestY=player.y;entities=entities.filter(e=>['gem','heal'].includes(e.type));
 if(run.cleared===3){end(true);return;}
 biome=run.cleared;pal=palettes[biome];buildScenery();generated=player.y+240;
 for(let i=0;i<12;i++)entities.push({type:'gem',x:W/2+Math.sin(i)*45,y:player.y+60+i*17,t:i});
 toast(b.name+' ПОДОЛАНО · +1 ♥',3.3);teach('biome-'+biome,pal.name+' · Нові істоти й небезпеки',4);updateHUD();
}
function updateBoss(dt){
 const b=run.boss;if(!b)return;b.t+=dt;b.hurt=Math.max(0,b.hurt-dt);b.y+=balance.fallSpeed*dt;
 if(player.dashing<=0)b.y+=(player.y+110-b.y)*(1-Math.exp(-dt*2.5));
 b.y=Math.min(b.y,player.y+190);
 const amplitude=Math.max(15,(W-240)*(b.id==='bell'?.23:.32));b.x=W/2+Math.sin(b.t*(b.id==='mother'?.5:.37))*amplitude;
 if(b.hp<=b.maxHp*.5&&b.phase===1){b.phase=2;toast(b.name+' · ФАЗА II',2);effect('ring',b.x,b.y,b.color,110,.7);audio.event('boss');}
 if(b.attack){b.attack.timer-=dt;if(b.attack.timer<=0)fireAttack(b);}else{b.shot-=dt;if(b.shot<=0)prepareAttack(b);}
 const swept=player.dashing>0&&Math.abs(player.x-b.x)<41&&player.prevY<b.y+40&&player.y>b.y-45;
 if(swept||Math.hypot(player.x-b.x,(player.y-b.y)*.8)<43){
  if(player.dashing>0&&b.hurt<=0){
   const impactY=b.y;b.hp=Math.max(0,b.hp-(1+Math.min(2,run.fang)+(player.reboundTime>0?Math.min(2,run.rebound):0)));b.hurt=.65;b.y=player.y+110;player.charges=Math.min(run.maxCharges,player.charges+1);kickUp(balance.bossJump,balance.bossHitGrace);
   entities=entities.filter(e=>e.type!=='bullet'||Math.hypot(e.x-player.x,e.y-player.y)>75);
   burst(b.x,impactY,b.color,38,210);effect('slash',b.x,impactY,b.color,70,.4);effect('ring',b.x,impactY,b.color,85,.5);shake=8;hitstop=.06;audio.event('kill',4);label(b.x,impactY-35,'−'+(1+run.fang),'#fff0c8');if(b.hp<=0)defeatBoss();
  }else if(player.dashing<=0&&b.hurt<=0)hurt();
 }
}
function sweptDistance(e){
 const ax=(e.prevX??e.x)-player.prevX,ay=(e.prevY??e.y)-player.prevY,bx=e.x-player.x,by=e.y-player.y,dx=bx-ax,dy=by-ay;
 const t=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(ax+t*dx,ay+t*dy);
}
function updateEnemy(e,dt,realDt){
 e.frozen=Math.max(0,(e.frozen||0)-realDt);const step=dt*(e.frozen>0?.1:1);e.t+=step;
 if(run.frost&&player.dashing>0&&Math.hypot(e.x-player.x,e.y-player.y)<75+run.frost*10&&e.frozen<=0){e.frozen=1.5+run.frost*.5;effect('star',e.x,e.y,'#b9dfff',25,.3);}
 if(e.kind==='moth')e.x=e.baseX+Math.sin(e.t*2)*28;
 if(e.kind==='jelly'){e.x=e.baseX+Math.sin(e.t)*45;e.y-=step*12;}
 if(e.kind==='spore'){e.x=e.baseX+Math.sin(e.t*1.4)*20;e.y-=step*9;}
 if(e.kind==='wisp'){e.x+=(player.x-e.x)*step*.38;e.y-=step*18;}
 if(e.kind==='beetle')e.x=e.baseX+Math.sin(e.t*2.7)*42;
 e.x=clamp(e.x,playerEdge()+4,W-playerEdge()-4);
 if(e.y>player.y+55&&e.y<player.y+H*.85&&e.frozen<=0){
  e.shot-=step;
  if(e.kind==='stalker'){
   if(e.shot<.6&&e.lockX===undefined)e.lockX=player.x;
   if(e.shot<=0){e.rush=.45;e.rushV=Math.sign(e.lockX-e.x)*185;e.lockX=undefined;e.shot=2.7;}
  }else if(['eye','sentinel','turret'].includes(e.kind)&&e.shot<=0){
   e.shot=e.kind==='turret'?2.5:3.1;const aim=Math.atan2(player.y-e.y,player.x-e.x),n=e.kind==='eye'?1:e.kind==='turret'?3:2;
   for(let j=0;j<n;j++){const angle=aim+(j-(n-1)/2)*.2;shoot(e.x,e.y,Math.cos(angle)*100,Math.sin(angle)*100,biome===2?'#ffb17f':biome===0?'#a4dfcf':'#cf9fdd');}
   effect('ring',e.x,e.y,biome===2?'#ffb17f':'#a8d5c4',18,.25);
  }
 }
 if(e.rush>0){e.rush-=step;e.x=clamp(e.x+e.rushV*step,playerEdge()+4,W-playerEdge()-4);e.baseX=e.x;}
 if(Math.abs(e.y-player.y)<95&&!run.taught.graze&&!run.boss)teach('graze','<b>Світлий обідок = ризик.</b> Промини його край без дотику: +20 фокусу.',6);
}
function updateHazard(e,dt){
 if(e.dormant&&e.y>player.y+(e.type==='beam'?180:H*.75))return;e.dormant=false;
 e.age=(e.age||0)+dt;
 if(e.life!==undefined&&e.age>=e.life){
  if(e.type==='bomb'){entities.push({type:'cloud',x:e.x,y:e.y,r:33,age:0,life:3.5,color:'#cfa9e2'});effect('ring',e.x,e.y,'#cfa9e2',48,.5);audio.event('spores');}
  e.dead=true;return;
 }
 const dx=e.x-player.x,dy=e.y-player.y;
 if(['spring','prism','flow'].includes(e.type)&&!e.used){
  if(player.vy>0&&player.prevY<e.y&&sweptDistance(e)<(e.type==='flow'?25:24))bounce(e);
  else if(dy>20&&dy<H*.65)teach('bounce','<b>Гриб, призма й кільце підкидають угору.</b> Рухайся A / D, щоб обрати місце наступного падіння.',5);
 }
 if(e.type==='beam'&&e.age>=e.warn&&player.y>e.y&&player.y<e.y+e.h&&Math.abs(dx)<e.w/2+8)hurt(true);
 if(e.type==='wave'){
  if(e.age>=e.warn){e.y+=e.vy*dt;const crossed=e.y<player.y+10&&e.prevY>player.prevY-10;
   if((Math.abs(e.y-player.y)<16||crossed)&&Math.abs(player.x-e.gap)>e.gapWidth/2-8)hurt(true);
  }
 }
 if(e.type==='cloud'&&Math.hypot(dx,dy)<e.r){
  if(player.dashing>0){e.dead=true;burst(e.x,e.y,e.color,18,85);effect('ring',e.x,e.y,e.color,45,.4);}else if(Math.hypot(dx,dy)<e.r*.72)hurt();
 }
 if(e.type==='flame'){
  e.tick=(e.tick||0)-dt;if(e.tick<=0){e.tick=.15;for(const other of entities)if(other.type==='enemy'&&!other.dead&&Math.hypot(other.x-e.x,other.y-e.y)<e.r)kill(other,'fire');}
 }
 if(e.type==='mine'){
  if(Math.hypot(dx,dy)<27&&player.dashing>0){e.dead=true;detonate(e.x,e.y,85,'#ffba7b','mine');audio.event('kill');}
  else if(Math.hypot(dx,dy)<105){e.fuse=(e.fuse??.7)-dt;if(e.fuse<=0){e.dead=true;radial(e.x,e.y,8,100,'#ffac75');effect('ring',e.x,e.y,'#ffac75',60,.5);if(Math.hypot(dx,dy)<45)hurt();audio.event('kill');}}
 }
 if(e.type==='echo'){
  if(e.age>.24){e.y+=520*dt;for(const enemy of entities)if(enemy.type==='enemy'&&!enemy.dead&&Math.abs(enemy.x-e.x)<23&&enemy.y>e.prevY-15&&enemy.y<e.y+20)kill(enemy,'echo');}
 }
}
function update(realDt){
 time+=realDt;audio.update();
 if(toastTimer>0){toastTimer-=realDt;if(toastTimer<=0)$('toast').classList.remove('show');}
 if(state==='countdown'){count-=realDt;$('countdown').textContent=Math.ceil(count);if(count<=0)setState('playing');return;}
 if(state!=='playing')return;
 if(coachTimer>0){coachTimer-=realDt;if(coachTimer<=0)show('coach',false);}
 if(grazeTimer>0){grazeTimer-=realDt;if(grazeTimer<=0){$('graze-notice').classList.remove('show');document.querySelector('.focus-track').classList.remove('graze');}}
 for(const fx of effects)fx.life-=realDt;effects=effects.filter(fx=>fx.life>0);
 for(const p of particles){p.life-=realDt;p.x+=p.vx*realDt;p.y+=p.vy*realDt;p.vy+=80*realDt;p.vx*=1-realDt*2;}particles=particles.filter(p=>p.life>0);
 for(const l of labels){l.life-=realDt;l.y-=realDt*18;}labels=labels.filter(l=>l.life>0);
 shake*=Math.exp(-realDt*18);flash=Math.max(0,flash-realDt);
 if(hitstop>0){hitstop-=realDt;return;}
 run.elapsed+=realDt;
 if(hintStarted>=0&&run.elapsed-hintStarted>7)$('hint').style.opacity='0';
 player.focusActive=(keys.has('ShiftLeft')||keys.has('ShiftRight')||heldTouch.has('focus'))&&player.focus>1;
 const slow=player.focusActive?.37:1,dt=realDt*slow;
 player.focus=clamp(player.focus+(player.focusActive?-balance.focusDrain*run.focusMod:balance.focusRegen)*realDt,0,100);
 const move=(keys.has('KeyD')||keys.has('ArrowRight')||heldTouch.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||heldTouch.has('left')?1:0);
 if(move&&hintStarted<0)hintStarted=run.elapsed;
 player.prevX=player.x;player.prevY=player.y;
 player.vx+=(move*235-player.vx)*(1-Math.exp(-realDt*13));player.x=clamp(player.x+player.vx*realDt,playerEdge(),W-playerEdge());
 const wasDash=player.dashing>0;player.dashing=Math.max(0,player.dashing-dt);player.invuln=Math.max(0,player.invuln-realDt);player.boost=Math.max(0,player.boost-dt);player.reboundTime=Math.max(0,player.reboundTime-dt);
 if(wasDash&&player.dashing<=0)releaseEcho();
 if(player.dashing<=0){if(wasDash&&player.vy>balance.fallSpeed)player.vy=balance.fallSpeed;player.vy=Math.min(balance.fallSpeed,player.vy+balance.gravity*dt);}
 player.y+=player.vy*dt;
 if(!run.boss){const nextBoss=content.bosses[run.cleared]?.depth||1500;run.depth=Math.min(nextBoss,run.depth+Math.max(0,player.y-run.deepestY)/balance.worldUnitsPerMeter);run.deepestY=Math.max(run.deepestY,player.y);}
 cam+=(player.y-H*.29-cam)*(1-Math.exp(-realDt*(player.dashing>0?18:8)));cam=Math.max(0,cam);
 if(player.charges<run.maxCharges){player.chargeTime+=realDt;if(player.chargeTime>=run.recharge){player.chargeTime-=run.recharge;player.charges++;}}else player.chargeTime=0;
 if(run.ward&&!player.ward){run.wardTime+=realDt;if(run.wardTime>=balance.wardCooldown){player.ward=true;effect('hex',player.x,player.y,'#f2ce9c',40,.5);audio.event('shield');}}
 trails.unshift({x:player.x,y:player.y,dash:player.dashing>0,color:player.reboundTime>0?'#c3b3ed':'#f4d49b'});if(trails.length>20)trails.pop();
 run.comboTime=Math.max(0,run.comboTime-realDt);if(run.comboTime<=0)run.combo=0;
 generate();
 const entityCount=entities.length;
 for(let i=0;i<entityCount;i++){
  const e=entities[i];if(e.dead)continue;e.prevX=e.x;e.prevY=e.y;
  if(e.used&&e.rewarded&&!e.exhausted){e.cooldown=Math.max(0,(e.cooldown||0)-dt);if(e.cooldown<=0&&player.y<e.y-30)e.used=false;}
  if(e.type==='enemy')updateEnemy(e,dt,realDt);
  if(e.type==='bullet'||e.type==='friendly'){
   e.age=(e.age||0)+dt;if(e.age>(e.life||4)){e.dead=true;continue;}
   if(e.curve){const a=e.curve*dt,vx=e.vx;e.vx=vx*Math.cos(a)-e.vy*Math.sin(a);e.vy=vx*Math.sin(a)+e.vy*Math.cos(a);}
   if(e.homing){const target=entities.find(o=>o.type==='enemy'&&!o.dead&&Math.hypot(o.x-e.x,o.y-e.y)<230);if(target){const a=Math.atan2(target.y-e.y,target.x-e.x);e.vx+=(Math.cos(a)*250-e.vx)*dt*7;e.vy+=(Math.sin(a)*250-e.vy)*dt*7;}}
   e.x+=e.vx*dt;e.y+=e.vy*dt;
  }
  const dx=e.x-player.x,dy=e.y-player.y;
  if(e.type==='gem'||e.type==='heal'){
   const radius=e.type==='gem'?34+run.magnet*60:25;
   if(Math.hypot(dx,dy)<radius){e.x-=dx*realDt*8;e.y-=dy*realDt*8;}
   if(sweptDistance(e)<17){e.dead=true;if(e.type==='heal')heal();else{run.shards++;run.collected++;player.focus=clamp(player.focus+balance.focusOnGem,0,100);if(run.harvest)player.chargeTime+=.04*run.harvest;burst(e.x,e.y,'#eac17a',5,32);audio.event('gem',run.shards%6);if(run.magnet&&run.collected%balance.magnetHealEvery===0)heal();}}
  }else if(e.type==='enemy'||e.type==='bullet'){
   const distance=sweptDistance(e),hit=distance<(e.type==='bullet'?11:18);
   if(hit){if(player.dashing>0){if(e.type==='enemy'){kill(e);kickUp(balance.enemyJump);}else{e.dead=true;burst(e.x,e.y,e.color||'#f1bc93',7,45);effect('star',e.x,e.y,e.color||'#f1bc93',15,.25);}}else hurt();}
   near(e,distance,hit);
   if(run.orbit&&!e.dead)for(let j=0;j<run.orbit;j++){const a=time*4+j*TAU/run.orbit,ox=player.x+Math.cos(a)*39,oy=player.y+Math.sin(a)*29;if(Math.hypot(e.x-ox,e.y-oy)<18){if(e.type==='enemy')kill(e,'orbit');else{e.dead=true;effect('star',e.x,e.y,'#e8d7a3',20,.25);}break;}}
  }else if(e.type==='spikes'||e.type==='rock'){
   const hit=player.x>e.x-9&&player.x<e.x+e.w+9&&(Math.abs(dy)<17||(player.y>e.y&&player.prevY<e.y));
   if(hit){if(e.type==='rock'){if(player.dashing>0){e.dead=true;detonate(player.x,e.y,52,'#b6cab0','rock');kickUp(balance.rockJump);audio.event('kill');}else if(player.prevY<e.y&&player.vy>0)bounce(e);}else hurt(true);}
   near(e,Math.hypot(player.x-clamp(player.x,e.x,e.x+e.w),dy),hit);
  }else if(e.type==='friendly'){
   for(const enemy of entities){if(enemy.type==='enemy'&&!enemy.dead&&Math.hypot(enemy.x-e.x,enemy.y-e.y)<18){e.dead=true;kill(enemy,'shard');break;}}
   if(run.boss&&Math.hypot(run.boss.x-e.x,run.boss.y-e.y)<35){e.dead=true;effect('star',e.x,e.y,run.boss.color,12,.2);}
  }else updateHazard(e,dt);
 }
 entities=entities.filter(e=>!e.dead&&e.y+(e.h||0)>cam-120&&e.y<player.y+H+600&&e.x>-80&&e.x<W+80);
 if(run.boss)updateBoss(dt);
 if(state!=='playing')return;
 if(!run.boss){
  if(run.depth>=run.nextGate&&run.nextGate<1500){enterUpgrade();}
  else if(run.depth>=content.bosses[run.cleared]?.depth)beginBoss();
 }
 hudClock+=realDt;if(hudClock>.075){updateHUD();hudClock=0;}
}

function drawBackdrop(scroll,title=false){
 drawCavernDepth(scroll,title);
 drawCavernWalls(scroll);
 drawCavernVignette();
}
function drawCavernDepth(scroll,title){
 ctx.fillStyle=pal.bg;ctx.fillRect(0,0,W,H);
 const by=-(scroll*(title?titleFarSpeed:.18))%820;
 for(let y=by;y<H;y+=820)ctx.drawImage(backCache,0,Math.floor(y));
 // Waterlit shafts of light, drawn as discrete pixel bands.
 ctx.globalAlpha=.045;for(let i=0;i<5;i++){const x=(W*.19+i*W*.2+Math.sin(time*.1+i)*5);poly([[x-12,0],[x+15,0],[x-80,H],[x-125,H]],pal.accent);}ctx.globalAlpha=1;
 const ringX=title?W*.73:W*.5;
 const ringY=title?H+135-wrap(H*.56+135+scroll*titleFarSpeed,H+270):((360-scroll*.1)%(H+350)+H+350)%(H+350)-100;
 drawRing(ringX,ringY,title?111:125,title?.9:.35);
 // Parallax broken islands and masonry.
 const sy=scroll*.43;
 for(let i=0;i<7;i++){
  const y=((i*157-sy)%(H+180)+H+180)%(H+180)-80,left=i%2===0,x=left?45:W-125,width=60+rng(i+4)*70;
  rect(x,y,width,8,pal.back);rect(x+8,y+8,width-18,9,pal.back);rect(x+18,y+17,width-35,13,pal.back);
  for(let j=0;j<3;j++)rect(x+15+j*15,y+25,4,14+rng(i+j)*26,pal.back);
 }
 // Slow luminous motes, no allocations in the render loop.
 for(let i=0;i<(quality?48:25);i++){
  const x=rng(i+52)*W+Math.sin(time*.4+i)*7,y=((rng(i+76)*H-time*(2+rng(i)*5)-scroll*.32)%H+H)%H;
  ctx.globalAlpha=.15+(Math.sin(time+i)+1)*.15;rect(x,y,i%7===0?2:1,biome===2?2:1,i%4===0?'#e3c18b':pal.accent);
 }ctx.globalAlpha=1;
 if(biome===0){for(let i=0;i<8;i++){const x=i%2?W-80-rng(i)*12:80+rng(i)*12,yy=((time*80+i*101-scroll*.6)%H+H)%H;rect(x,yy,1,7,'#69a2a344');}}
 if(biome===1){for(let i=0;i<(quality?12:5);i++){const x=rng(i+93)*W+Math.sin(time*.5+i)*12,y=((rng(i+17)*H-time*6-scroll*.25)%H+H)%H;rect(x,y,2,2,'#c6abd573');if(i%4===0)light(x,y,16,'#c7a0e4',.08);}}
 if(biome===2){for(let i=0;i<8;i++){const x=i%2?W-73:73,yy=((i*95-scroll*.5)%(H+100)+H+100)%(H+100)-50;rect(x,yy,2,25,'#ae6c4a');light(x,yy+10,35,'#eb9d64',.11);}}
}
function drawCavernWalls(scroll){
 const wy=-(scroll*titleWallSpeed)%768,wallWidth=W<440?76:110;
 for(let y=wy;y<H;y+=768){ctx.drawImage(wallCache,0,0,110,768,0,Math.floor(y),wallWidth,768);ctx.save();ctx.translate(W,Math.floor(y));ctx.scale(-1,1);ctx.drawImage(wallCache,0,0,110,768,0,0,wallWidth,768);ctx.restore();}
 for(let side=0;side<2;side++){
  for(let i=0;i<5;i++){
   const y=((i*190-scroll)%(H+190)+H+190)%(H+190)-60,wallX=W<440?46:67,x=side?W-wallX:wallX;
   if(i%2===0)drawLantern(x,y,i);else drawPlant(x,y,side?-1:1,i);
  }
 }
}
function drawCavernVignette(){
 const vignette=ctx.createLinearGradient(0,0,0,H);vignette.addColorStop(0,'#06131c77');vignette.addColorStop(.2,'#06131c00');vignette.addColorStop(.75,'#06131c00');vignette.addColorStop(1,'#06131c99');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function drawRing(x,y,r,alpha){
 ctx.save();ctx.globalAlpha=alpha;
 for(let i=0;i<32;i++){
  const a=i*TAU/32,px=Math.round(x+Math.cos(a)*r),py=Math.round(y+Math.sin(a)*r);
  if(i===5||i===20)continue;
  ctx.save();ctx.translate(px,py);ctx.rotate(a);rect(-10,-10,18,20,pal.rock);rect(-9,-10,5,19,pal.light);rect(7,-8,2,15,pal.back);if(i%3===0){rect(-3,-3,6,1,pal.edge);rect(-1,-5,1,6,pal.edge);}ctx.restore();
 }
 // Suspended seal at the center.
 line(x,y-r+12,x,y-28,pal.light);line(x-1,y-r+12,x-1,y-28,pal.back);
 poly([[x,y-30],[x+18,y],[x,y+30],[x-18,y]],pal.rock);poly([[x,y-23],[x+12,y],[x,y+23],[x-12,y]],pal.edge);poly([[x,y-15],[x+6,y],[x,y+15],[x-6,y]],'#b0c4a0');
 ctx.restore();light(x,y,100,pal.accent,alpha*.12);
}
function drawLantern(x,y,i){
 rect(x-4,y-11,8,2,'#6b785e');rect(x-3,y-9,6,15,'#263f3b');rect(x-2,y-7,4,9,'#d9b36c');rect(x-1,y-6,2,6,'#ffdf9c');rect(x-5,y+6,10,3,'#4f6551');
 light(x,y,45,'#edba6e',.23+Math.sin(time*6+i)*.025);
}
function drawPlant(x,y,dir,i){
 const col=biome===1?'#ac91bb':pal.moss;
 for(let j=0;j<3;j++){const xx=x+dir*j*6,yy=y+Math.sin(j+i)*5;rect(xx,yy,2,11+j*3,col);rect(xx-3,yy,8,3,col);rect(xx-5,yy+2,12,2,col);if(biome===1)rect(xx-3,yy-1,8,1,'#d2bbcf');else rect(xx-2,yy-1,6,1,pal.edge);}
 if(biome===1)light(x,y,35,'#ca92e3',.18);
}
function drawHero(x,y,scale=1.3,title=false){
 const dashActive=!title&&player.dashing>0,inv=!title&&player.invuln>0;
 const sway=Math.sin(time*5)*2;
 light(x,y,45*scale,dashActive?'#f4d999':'#b6e2c5',dashActive?.45:.13);
 // Segmented scarf follows wind and horizontal inertia.
 for(let i=7;i>=0;i--){const xx=x-4*scale+Math.sin(time*6-i*.55)*2*scale-(title?0:player.vx*.01*i),yy=y-(6+i*3)*scale*(!title&&player.vy<0?-1:1);
  rect(xx,yy,5*scale,4*scale,i%2?'#d09a62':'#e1b878');rect(xx+scale,yy,scale,3*scale,'#f6d498');}
 if(inv&&Math.floor(time*12)%3===0)ctx.globalAlpha=.4;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));if(!reduced)ctx.rotate(title?-.08:clamp(player.vx*.0006,-.12,.12));
 ctx.drawImage(sprites.hero,-sprites.hero.width*scale/2,(-12+sway*.25)*scale,sprites.hero.width*scale,sprites.hero.height*scale);ctx.restore();ctx.globalAlpha=1;
 if(dashActive){rect(x-7,y+13,14,4,'#f9dfaa');rect(x-3,y+17,6,8,'#fff1be');}
 if(!title&&player.ward){ctx.strokeStyle='#f1ce8c';ctx.globalAlpha=.55+Math.sin(time*3)*.12;ctx.beginPath();for(let i=0;i<=6;i++){const a=i*TAU/6+Math.PI/6;const xx=x+Math.cos(a)*23,yy=y+Math.sin(a)*27;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();ctx.globalAlpha=1;}
}
function drawEntity(e){
 const y=Math.round(e.y-cam),x=Math.round(e.x);
 if(!['gem','heal','enemy','bullet','rock','spikes'].includes(e.type)){drawSpecial(e,x,y);return;}
 if(y<-50||y>H+60)return;
 if(e.type==='gem'){const sy=Math.round(y+Math.sin(time*3+(e.t||0))*2);light(x,sy,15,'#e6b467',.2);ctx.drawImage(sprites.gem,x-4,sy-4);}
 if(e.type==='heal'){light(x,y,25,'#ec9a8a',.3);ctx.drawImage(sprites.heart,x-7,y-6,14,12);}
 if(e.type==='enemy'){
  drawGrazeZone(e,x,y,33);
  const s=sprites[e.kind],wing=e.kind==='moth'?1+Math.sin(time*12+e.t)*.13:1,size=1.35;
  if(e.kind==='eye')light(x,y,23,'#f1957e',.2);
  ctx.drawImage(s,x-s.width*wing*size/2,y-s.height*size/2,s.width*wing*size,s.height*size);
  if(e.kind==='jelly'){for(let j=0;j<3;j++)rect(x-5+j*5+Math.sin(time*4+j)*2,y+5+j%2*2,1,7,'#8fb8bd');}
  if(e.frozen>0){ctx.globalAlpha=.55;rect(x-9,y-9,18,18,'#a2d4eb');ctx.globalAlpha=1;for(let j=0;j<4;j++){const a=j*TAU/4+time*.3,xx=x+Math.cos(a)*14,yy=y+Math.sin(a)*14;rect(xx,yy,3,3,'#d6f3ff');}}
  if(e.lockX!==undefined){ctx.globalAlpha=.4;line(x,y,e.lockX,y,'#e1b6d9');ctx.globalAlpha=1;rect(e.lockX-2,y-3,4,6,'#efc6e7');}
  if(['eye','sentinel','turret'].includes(e.kind)&&e.shot<.65)light(x,y,25,'#ffba89',.45);
 }
 if(e.type==='bullet'){const color=e.color||'#f3a07e';drawGrazeZone(e,x,y,25);if(e.meteor){line(x-e.vx*.16,y-e.vy*.16,x,y,'#c76b4c',5);line(x-e.vx*.1,y-e.vy*.1,x,y,color,2);}light(x,y,e.meteor?22:13,color,.27);rect(x-3,y-3,6,6,'#85535a');rect(x-2,y-2,4,4,color);rect(x-1,y-1,2,2,'#fff0c7');}
 if(e.type==='spikes'){
  rect(x,y+3,e.w,9,'#4f4545');rect(x,y+11,e.w,5,'#2a3339');
  for(let i=0;i<e.w-5;i+=9){poly([[x+i,y+4],[x+i+4,y-8],[x+i+8,y+4]],'#b16c63');rect(x+i+4,y-5,1,8,'#e8a18a');}rect(x,y+4,e.w,2,'#bd8270');
 }
 if(e.type==='rock'){
  rect(x,y,e.w,12,pal.rock);rect(x+3,y+12,e.w-7,5,pal.back);rect(x,y,e.w,2,pal.edge);rect(x+e.w*.4,y+2,1,8,pal.back);rect(x+e.w*.7,y+5,1,7,pal.back);
  for(let j=0;j<3;j++)rect(x+5+j*9,y-2,5,2,pal.moss);
  if(!e.used){poly([[x+e.w/2-4,y+21],[x+e.w/2,y+16],[x+e.w/2+4,y+21]],'#9ebbaa');}
 }
}
function drawGrazeZone(e,x,y,r){
 if(!player||run.boss||e.near||e.grazeFailed||Math.abs(e.y-player.y)>85||Math.abs(e.x-player.x)>100)return;
 ctx.save();ctx.globalAlpha=e.grazeArmed?.8:.27;ctx.strokeStyle='#a9e9cd';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.restore();
 if(e.grazeArmed){line(x,y,player.x,player.y-cam,'#b5eed366');light(x,y,42,'#a8e6ce',.1);}
}
function drawSpecial(e,x,y){
 if(e.type==='beam'){
  if(y>H||y+e.h<0)return;const warning=e.age<e.warn;
  ctx.save();ctx.globalAlpha=warning?.18+Math.sin(time*16)*.08:.2;rect(x-e.w,y,e.w*2,e.h,e.color);ctx.globalAlpha=1;
  if(warning){ctx.setLineDash([4,5]);line(x,y,x,y+e.h,e.color);ctx.setLineDash([]);poly([[x-4,clamp(y,15,H-20)],[x+4,clamp(y,15,H-20)],[x,clamp(y,15,H-20)+7]],e.color);}
  else{rect(x-e.w/2,y,e.w,e.h,e.color);rect(x-2,y,4,e.h,'#fff5d9');}
  ctx.restore();return;
 }
 if(y<-90||y>H+100)return;
 if(['spring','prism','flow'].includes(e.type)){
  const col=e.type==='spring'?'#d5afea':e.type==='prism'?'#b6d3ff':'#a8e7cf';ctx.save();if(e.used)ctx.globalAlpha=.3;
  if(!e.used)light(x,y,38,col,.2);
  if(e.type==='spring'){
   rect(x-5,y+3,10,14,'#7b6686');rect(x-2,y+4,3,12,'#c0a5c4');rect(x-19,y-2,38,6,'#8a709c');rect(x-15,y-7,30,5,'#b29ac2');rect(x-9,y-11,18,4,'#d3bbdf');rect(x-17,y+2,34,2,'#e2c9e7');rect(x-10,y-5,3,3,'#f5e1e2');rect(x+6,y-3,4,2,'#f3dcd8');
  }else if(e.type==='prism'){
   poly([[x,y-21],[x+15,y],[x,y+21],[x-15,y]],'#445d80');poly([[x,y-17],[x+11,y],[x,y+17],[x-11,y]],'#aac6e9');poly([[x,y-17],[x,y+17],[x-11,y]],'#e1eddf');line(x,y-13,x+7,y,col);
  }else{
   ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,17,22,0,0,TAU);ctx.stroke();ctx.strokeStyle='#456d68';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,21,26,0,0,TAU);ctx.stroke();
  }
  if(!e.used)poly([[x-6,y+4],[x,y-4],[x+6,y+4],[x,y]],'#eef3d1');
  for(let i=0;i<balance.objectBounces;i++)rect(x-8+i*6,y+30,4,2,i<balance.objectBounces-(e.bounceUses||0)?col:'#405456');
  ctx.restore();return;
 }
 if(e.type==='friendly'){
  const col=e.color||'#c8ddfa';line(x-e.vx*.035,y-e.vy*.035,x,y,col,2);poly([[x,y-5],[x+3,y],[x,y+5],[x-3,y]],col);light(x,y,14,col,.18);return;
 }
 if(e.type==='echo'){
  ctx.save();ctx.globalAlpha=Math.min(.5,e.age*2);ctx.drawImage(sprites.hero,x-12,y-15,24,30);rect(x-2,y+15,4,20,'#badbd2');ctx.restore();return;
 }
 if(e.type==='cloud'){
  const col=e.color||'#caa9df';light(x,y,e.r*1.6,col,.15);ctx.save();ctx.globalAlpha=.24;
  for(let i=0;i<7;i++){const a=i*TAU/7+time*.3;rect(x+Math.cos(a)*e.r*.45-10,y+Math.sin(a)*e.r*.45-7,20,14,col);}ctx.globalAlpha=.65;
  for(let i=0;i<5;i++){const a=i*1.4+time;rect(x+Math.cos(a)*e.r*.7,y+Math.sin(a)*e.r*.7,2,2,col);}ctx.restore();return;
 }
 if(e.type==='flame'){
  light(x,y,e.r*1.6,'#ffc582',.25);for(let i=0;i<7;i++){const xx=x+(i-3)*6,hh=8+(Math.sin(time*9+i*3)+1)*8;rect(xx,y-hh,4,hh,'#c77b50');rect(xx+1,y-hh*.6,2,hh*.6,'#f4c27e');}return;
 }
 if(e.type==='mine'||e.type==='bomb'){
  const col=e.color||'#f6b78b',r=e.type==='bomb'?22:14;ctx.save();ctx.globalAlpha=.25+Math.sin(time*14)*.1;ctx.strokeStyle=col;ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(x,y,r+8,0,TAU);ctx.stroke();ctx.restore();
  for(let i=0;i<6;i++){const a=i*TAU/6;line(x+Math.cos(a)*5,y+Math.sin(a)*5,x+Math.cos(a)*r,y+Math.sin(a)*r,col,2);}rect(x-5,y-5,10,10,biome===1?'#736080':'#905744');rect(x-2,y-2,4,4,col);light(x,y,30,col,e.fuse!==undefined?.4:.18);return;
 }
 if(e.type==='wave'){
  const left=e.gap-e.gapWidth/2,right=e.gap+e.gapWidth/2,warn=e.age<e.warn;
  if(warn){ctx.save();ctx.globalAlpha=.35;ctx.setLineDash([5,5]);line(e.x,y,left,y,e.color);line(right,y,e.x+e.w,y,e.color);ctx.restore();}
  else{rect(e.x,y-5,left-e.x,10,'#d98458');rect(right,y-5,e.x+e.w-right,10,'#d98458');rect(e.x,y-1,left-e.x,3,'#ffe1a0');rect(right,y-1,e.x+e.w-right,3,'#ffe1a0');for(let xx=e.x;xx<e.x+e.w;xx+=10)if(xx<left-5||xx>right+2)poly([[xx,y-4],[xx+4,y-14-Math.sin(time*10+xx)*4],[xx+8,y-4]],e.color);}
  line(left+3,y-10,left+3,y+10,'#c9e9c5');line(right-3,y-10,right-3,y+10,'#c9e9c5');ctx.fillStyle='#d5eccc';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText('ПРОХІД',e.gap,y+3);ctx.textAlign='left';
 }
}
function drawEffects(){
 for(const f of effects){
  const p=1-f.life/f.duration,x=f.x,y=f.y-cam,r=f.radius*(.3+p*.7);if(y<-250||y>H+250)continue;
  ctx.save();ctx.globalAlpha=Math.min(1,f.life*4);ctx.strokeStyle=f.color;ctx.fillStyle=f.color;ctx.lineWidth=1;
  if(f.type==='ring'){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.globalAlpha*=.3;ctx.beginPath();ctx.arc(x,y,r*.8,0,TAU);ctx.stroke();}
  if(f.type==='slash'){const spread=r*.65;poly([[x-spread,y-spread*.6],[x+spread,y+spread*.35],[x+spread*.2,y+spread*.1]],f.color);poly([[x-spread*.5,y+spread*.8],[x+spread*.8,y-spread],[x,y-spread*.1]],f.color);}
  if(f.type==='star')for(let j=0;j<8;j++){const a=j*TAU/8;line(x+Math.cos(a)*r*.4,y+Math.sin(a)*r*.4,x+Math.cos(a)*r,y+Math.sin(a)*r,f.color,j%2?1:2);}
  if(f.type==='lightning'||f.type==='link'){
   const tx=f.tx,ty=f.ty-cam;ctx.beginPath();ctx.moveTo(x,y);for(let j=1;j<=9;j++){const t=j/9,jitter=f.type==='lightning'?Math.sin(j*19+f.x)*10*(1-t):0;ctx.lineTo(x+(tx-x)*t+jitter,y+(ty-y)*t-jitter);}ctx.lineWidth=f.type==='lightning'?2:1;ctx.stroke();
  }
  if(f.type==='hex'){ctx.beginPath();for(let j=0;j<=6;j++){const a=j*TAU/6;const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r;j?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();}
  if(f.type==='arrows'){const sign=f.up?-1:1,xx=x,yy=y+sign*p*38;for(let j=0;j<3;j++)poly([[xx-8,yy-sign*j*13-sign*5],[xx,yy-sign*j*13+sign*3],[xx+8,yy-sign*j*13-sign*5],[xx,yy-sign*j*13+sign*8]],f.color);}
  ctx.restore();
 }
}
function drawBoss(){
 const b=run.boss;if(!b)return;const x=Math.round(b.x),y=Math.round(b.y-cam);
 light(x,y,100,b.color,.24+(b.attack?.1:0));
 if(b.id==='bell'){
  for(let i=0;i<2;i++){const xx=x+(i?34:-34);line(xx,y-90,xx,y-30,'#4b6f68',2);for(let j=0;j<6;j++)rect(xx-2,y-90+j*10,4,5,'#77998a');}
  rect(x-8,y-56,16,10,'#b3c3a0');rect(x-20,y-46,40,9,'#829f8c');rect(x-29,y-37,58,13,'#67877b');rect(x-35,y-24,70,22,'#4b6d67');rect(x-42,y-2,84,12,'#8ba28a');rect(x-45,y+10,90,7,'#b4c29a');rect(x-37,y+17,74,6,'#355553');
  for(let i=0;i<5;i++){rect(x-29+i*14,y-20,4,22,'#a3b493');rect(x-28+i*14,y-19,1,21,'#d2d9b0');}
  rect(x-20,y-23,40,39,'#1a363c');rect(x-16,y-19,32,33,'#2f5656');
  for(let i=0;i<3;i++){const xx=x+(i-1)*42,yy=y+42+Math.sin(b.t*2+i)*6;rect(xx-4,yy-5,8,10,'#98bca1');rect(xx-1,yy-2,2,4,b.color);}
 }else if(b.id==='mother'){
  for(let i=0;i<6;i++){
   const base=x-32+i*13;ctx.strokeStyle=i%2?'#9c7ca9':'#6c5a80';ctx.lineWidth=i%2?4:3;ctx.beginPath();ctx.moveTo(base,y+8);for(let j=1;j<=5;j++)ctx.lineTo(base+Math.sin(b.t*2+i+j*.5)*9,y+8+j*10);ctx.stroke();rect(base+Math.sin(b.t*2+i+2.5)*9-2,y+56,4,6,'#d0acd8');
  }
  rect(x-42,y-21,84,11,'#765c88');rect(x-35,y-33,70,12,'#a484b4');rect(x-24,y-44,48,11,'#c0a2cd');rect(x-11,y-50,22,6,'#e5c3e4');rect(x-46,y-10,92,7,'#d2addc');rect(x-35,y-3,70,6,'#473b60');
  for(let i=0;i<5;i++)rect(x-30+i*15,y-25+Math.sin(i*5)*7,5,4,'#ead4dd');
  poly([[x-26,y],[x+26,y],[x+20,y+26],[x,y+39],[x-20,y+26]],'#5b4b72');
  for(let i=0;i<4;i++){const a=b.t*.4+i*TAU/4;const xx=x+Math.cos(a)*60,yy=y+Math.sin(a)*37;rect(xx-2,yy-2,4,4,'#dab7e4');}
 }else{
  for(let i=0;i<8;i++){
   const a=i*TAU/8+b.t*(b.phase===2?.22:.08),xx=x+Math.cos(a)*55,yy=y+Math.sin(a)*40;
   line(x+Math.cos(a)*25,y+Math.sin(a)*20,xx,yy,'#976d5d',3);rect(xx-7,yy-9,14,18,'#704f43');rect(xx-7,yy-9,14,3,'#b28b6a');rect(xx-2,yy-4,4,6,b.color);
  }
  for(let j=0;j<4;j++){const xx=x-31+j*20;line(xx,y+20,xx+Math.sin(b.t*2+j)*18,y+65,'#956d58',2);rect(xx+Math.sin(b.t*2+j)*18-2,y+62,4,8,'#e8ad77');}
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);rect(-25,-25,50,50,'#8c624c');rect(-21,-21,42,42,'#3a3031');ctx.restore();
 }
 // Every boss exposes the same bright, readable dash target.
 const core=b.hurt>0?'#fff6d7':b.color;poly([[x,y-21],[x+15,y],[x,y+21],[x-15,y]],'#263541');poly([[x,y-16],[x+11,y],[x,y+16],[x-11,y]],core);poly([[x,y-8],[x+5,y],[x,y+8],[x-5,y]],'#fff4cf');
 if(b.attack){ctx.save();ctx.strokeStyle=b.color;ctx.globalAlpha=.4+Math.sin(time*18)*.2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(x,y,69,0,TAU);ctx.stroke();ctx.restore();}
}
function wrap(n,span){return (n%span+span)%span;}
function drawTitleCavern(scroll){
 drawCavernDepth(scroll,true);
 for(let i=0;i<12;i++){
  const x=W*(.12+rng(i+191)*.78),y=H+24-wrap(i*61+scroll*.66,H+65);
  const width=10+rng(i+195)*25;
  rect(x,y,width,6,pal.rock);rect(x,y,width,2,pal.edge);rect(x+3,y+6,width*.6,4,pal.back);
 }
}
function drawOutgoingLayer(drawLayer,scroll,outgoing){
 const nextBiome=biome,nextPalette=pal,nextBackground=backCache,nextWall=wallCache;
 ({biome,pal,backCache,wallCache}=outgoing);
 drawLayer(scroll);
 biome=nextBiome;pal=nextPalette;backCache=nextBackground;wallCache=nextWall;
}
function seamHeight(x,y){
 const step=Math.floor(x/20);
 const arch=Math.pow(x/W*2-1,2)*54;
 return y+Math.round((arch+Math.sin(step*.49)*11+(rng(step+462)-.5)*24)/3)*3;
}
function drawBiomeSeam(y){
 const layer=foregroundCtx;
 const thickness=H*.54;
 foregroundCanvas.hidden=y>H+96||y+thickness+130<0;
 if(foregroundCanvas.hidden)return;
 layer.clearRect(0,0,W,H);
 const slabs=[];
 for(let x=-18,i=0;x<W+18;i++){
  const width=18+Math.floor(rng(i+513)*9)*4;
  const basin=Math.sin(x/W*Math.PI*2-.7)*H*.075;
  const top=y+Math.round((basin+(rng(i+120)-.5)*64)/4)*4;
  const bottom=y+thickness+Math.round((basin+(rng(i+220)-.5)*96)/4)*4;
  slabs.push({x,width,top,bottom});
  x+=width;
 }
 const shelf=new Path2D();
 shelf.moveTo(slabs[0].x,slabs[0].top);
 for(const slab of slabs){
  shelf.lineTo(slab.x,slab.top);shelf.lineTo(slab.x+slab.width,slab.top);
 }
 for(let i=slabs.length-1;i>=0;i--){
  const slab=slabs[i];
  shelf.lineTo(slab.x+slab.width,slab.bottom);shelf.lineTo(slab.x,slab.bottom);
 }
 shelf.closePath();
 layer.save();
 // Feather the shadow beyond the stone without rounding off the pixel ledges.
 layer.lineJoin='round';
 for(const width of [28,19,11,5]){
  layer.lineWidth=width;layer.strokeStyle='#04050919';layer.stroke(shelf);
 }
 const shade=layer.createLinearGradient(0,y-40,0,y+thickness+56);
 shade.addColorStop(0,'#10131acc');shade.addColorStop(.24,'#080b11f5');
 shade.addColorStop(.72,'#07090ff5');shade.addColorStop(1,'#181b22d9');
 layer.fillStyle=shade;layer.fill(shelf);
 layer.clip(shelf);
 for(let i=0;i<slabs.length;i++){
  const {x,width,top,bottom}=slabs[i];
  const joint=top+(bottom-top)*(.25+rng(i+331)*.42);
  layer.fillStyle=i%3===0?'#25293879':'#191e2966';
  layer.fillRect(x,top,width-4,7+i%3*4);
  layer.fillRect(x,top+8,8,joint-top);
  layer.fillStyle='#02040788';
  layer.fillRect(x+width-5,joint,5,bottom-joint);
  layer.fillRect(x+width*.42,joint,Math.ceil(width*.58),4);
  layer.fillRect(x+width*.42,joint-17,4,17);
  layer.fillStyle=pal.rock+'72';
  layer.fillRect(x+3,bottom-9,width-11,5);
  if(i%3===0)layer.fillRect(x+12,bottom-16,Math.ceil(width*.36),4);
 }
 layer.restore();
}
function drawCrossingLayer(drawLayer,scroll,boundary,outgoing,step){
 ctx.save();ctx.beginPath();ctx.moveTo(0,0);
 for(let x=0;x<W;x+=20){
  const y=seamHeight(x,boundary);
  ctx.lineTo(x,y);ctx.lineTo(Math.min(x+20,W),y);
 }
 ctx.lineTo(W,0);ctx.closePath();
 if(step==='walls'){
  // Each texture gets its own slice. Transparent parts of a wall reveal the deep cavern.
  ctx.save();ctx.clip();drawOutgoingLayer(drawLayer,scroll,outgoing);ctx.restore();
  ctx.rect(0,0,W,H);ctx.clip('evenodd');
  drawLayer(scroll);
 }else{
  ctx.clip();
  drawOutgoingLayer(drawLayer,scroll,outgoing);
 }
 ctx.restore();
}
function drawTitle(){
 let progress=titleTransition?(time-titleTransition.start)/titleCrossingDuration:0;
 if(progress>=1){titleTransition=null;changeTitleBiome();progress=0;}
 const scroll=reduced?0:titleScroll;
 drawTitleCavern(scroll);
 let foregroundY=0;
 if(titleTransition){
  const traveled=scroll-titleTransition.scrollStart;
  const farBoundary=H+18-traveled*titleFarSpeed;
  const wallBoundary=H+64-traveled*titleWallSpeed;
  foregroundY=wallBoundary;
  drawCrossingLayer(drawTitleCavern,scroll,farBoundary,titleTransition.outgoing,'depth');
  drawCrossingLayer(drawCavernWalls,scroll,wallBoundary,titleTransition.outgoing,'walls');
 }else drawCavernWalls(scroll);
 drawCavernVignette();
 const x=W*.73,y=H*.51+Math.sin(time*1.3)*5;
 drawHero(x,y,2.2,true);
 if(!reduced){
  const rush=Math.sin(progress*Math.PI);
  for(let i=0;i<22;i++){
   const px=rng(i+102)*W,py=H+20-wrap(i*79+scroll*(1.1+rng(i+191)*.7),H+50);
   ctx.globalAlpha=.14+(.12+rng(i+71)*.17)*rush;
   rect(px,py,1+i%2,4+i%5+13*rush,'#c7e4c5');
  }
  ctx.globalAlpha=1;
 }
 if(titleTransition)drawBiomeSeam(foregroundY);else foregroundCanvas.hidden=true;
}
function render(){
 ctx.imageSmoothingEnabled=false;
 if(state==='title'){drawTitle();return;}
 if(!foregroundCanvas.hidden)foregroundCanvas.hidden=true;
 if(!player)return;
 ctx.save();if(shake>.2&&!reduced)ctx.translate(Math.round(rand(-shake,shake)),Math.round(rand(-shake,shake)));
 drawBackdrop(cam);
 if(player.focusActive&&state==='playing'){ctx.fillStyle='#6b9e9810';ctx.fillRect(0,0,W,H);}
 for(let i=trails.length-1;i>=0;i--){const t=trails[i];if(!t.dash&&i%3!==0)continue;ctx.globalAlpha=(1-i/trails.length)*(t.dash?.36:.07);rect(t.x-(t.dash?6:4),t.y-cam-8,t.dash?12:8,18,t.dash?(t.color||'#f4d49b'):'#b0ddc4');}ctx.globalAlpha=1;
 for(const e of entities)drawEntity(e);
 drawBoss();
 for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);rect(p.x,p.y-cam,p.size,p.size,p.color);}ctx.globalAlpha=1;
 drawEffects();
 drawHero(player.x,player.y-cam);
 for(let i=0;i<run.orbit;i++){const a=time*4+i*TAU/run.orbit,x=player.x+Math.cos(a)*39,y=player.y-cam+Math.sin(a)*29;light(x,y,18,'#e9cc8d',.25);poly([[x,y-6],[x+3,y],[x,y+6],[x-3,y]],'#f2ddb0');}
 for(const l of labels){ctx.globalAlpha=Math.min(1,l.life*3);ctx.textAlign='center';ctx.font='bold 8px monospace';ctx.fillStyle='#071b21';ctx.fillText(l.text,Math.round(l.x)+1,Math.round(l.y-cam)+1);ctx.fillStyle=l.color;ctx.fillText(l.text,Math.round(l.x),Math.round(l.y-cam));}ctx.globalAlpha=1;ctx.textAlign='left';
 if(player.dashing>0){for(let i=0;i<8;i++){const xx=rng(i+17)*W,yy=(time*900+i*81)%H;rect(xx,yy,1,15+i%3*8,'#c1c9a64a');}}
 if(flash>0){ctx.fillStyle=`rgba(227,112,99,${flash*.55})`;ctx.fillRect(0,0,W,H);}
 ctx.restore();
 if(perfVisible){rect(7,H-22,206,15,'#00151de6');ctx.font='8px monospace';ctx.fillStyle='#b5e4c4';ctx.fillText(`CPU ${metrics.cpuMs.toFixed(1)}ms | ${metrics.fps}fps | E ${entities.length} P ${particles.length}`,12,H-12);}
}
function updateHUD(){
 if(!run||!player)return;
 const hearts=Array.from({length:run.maxHp},(_,i)=>`<span class="heart${i>=player.hp?' empty':''}">♥</span>`).join('');if($('health').innerHTML!==hearts)$('health').innerHTML=hearts;
 $('health').setAttribute('aria-label',`Здоров’я: ${player.hp} з ${run.maxHp}`);$('shards').textContent=run.shards;$('depth').textContent=Math.floor(run.depth);
 $('combo').textContent=run.combo>=2?'×'+run.combo:'';
 document.querySelector('.depth>small').textContent=run.boss?'РУБІЖ БОСА':'ГЛИБИНА';
 const nextBoss=content.bosses[run.cleared];$('depth-fill').style.width=run.boss?'100%':(run.depth%250/250*100)+'%';$('next-gate').textContent=run.boss?'РИВОК У ЯДРО':run.nextGate>=1500?'СЕРЦЕ НА 1500 М':'МУТАЦІЯ НА '+run.nextGate+' М';
 show('boss-ui',!!run.boss);document.querySelector('.biome').classList.toggle('has-boss',!!run.boss);
 if(run.boss){const b=run.boss;$('boss-ui').style.setProperty('--boss-color',b.color);$('boss-name').textContent=b.name;$('boss-phase').textContent='ФАЗА '+(b.phase===1?'I':'II');$('boss-health').style.width=(b.hp/b.maxHp*100)+'%';$('boss-attack').textContent=b.attack?attackNames[b.attack.kind]:'ЯДРО ВІДКРИТЕ · SPACE';}
 const charges=Array.from({length:run.maxCharges},(_,i)=>`<i class="charge${i>=player.charges?' empty':''}"></i>`).join('');if($('charges').innerHTML!==charges)$('charges').innerHTML=charges;
 $('focus-fill').style.width=player.focus+'%';$('biome-name').textContent=pal.name;$('biome-level').textContent=pal.layer;
 const relics=run.chosen.map(m=>m.icon).join('');if($('relics').textContent!==relics){$('relics').textContent=relics;$('relics').title=run.chosen.map(m=>m.name).join(', ');}
 $('music-now').textContent='♪ '+(content.music[audio.theme]?.name||content.music.title.name);
}
function toggleSound(){muted=!muted&&audio.ctx?.state==='running';audio.init();if(audio.ctx&&audio.master)audio.master.gain.setTargetAtTime(muted?0:.65,audio.ctx.currentTime,.04);try{localStorage.setItem('downfall-muted',muted);}catch{}updateSoundButton();}
function updateSoundButton(){const enabled=!muted&&audio.ctx?.state==='running';$('sound').classList.toggle('muted',!enabled);$('sound').textContent=enabled?'♪':'♩';$('sound').setAttribute('aria-label',enabled?'Вимкнути звук':'Увімкнути звук');$('sound').setAttribute('aria-pressed',String(!!enabled));}
function unlockAudio(e){if(e.code==='KeyM'||e.target?.closest?.('#sound'))return;if(!muted){audio.init();updateSoundButton();}}
addEventListener('pointerdown',unlockAudio,{capture:true});
addEventListener('keydown',unlockAudio,{capture:true});
updateSoundButton();
$('start').onclick=()=>reset(selectedLevel);$('again').onclick=()=>reset();$('restart').onclick=()=>reset();
$('levels').onclick=e=>{const b=e.target.closest('[data-level]');if(b)selectLevel(Number(b.dataset.level));};$('dev-unlock').onclick=()=>{devUnlock=!devUnlock;if(!devUnlock&&!isUnlocked(selectedLevel))selectLevel(0);updateLevelMenu();};updateLevelMenu();$('resume').onclick=()=>startCountdown();$('pause-button').onclick=()=>state==='paused'?startCountdown():pause();$('sound').onclick=toggleSound;
$('to-title').onclick=()=>{biome=selectedLevel;pal=palettes[biome];buildScenery();setState('title');updateLevelMenu();};
$('upgrade-cards').onclick=e=>{const b=e.target.closest('[data-choice]');if(b)choose(Number(b.dataset.choice));};
addEventListener('keydown',e=>{
 if((e.code==='Enter'||e.code==='Space')&&e.target?.closest?.('button'))return;
 if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.code)&&e.code!=='Tab')e.preventDefault();
 if(e.repeat)return;
 if(e.code==='KeyM'){toggleSound();return;}if(e.code==='F3'){e.preventDefault();perfVisible=!perfVisible;return;}
 if(state==='title'){if(e.code==='ArrowLeft')selectLevel(selectedLevel-1);else if(e.code==='ArrowRight')selectLevel(selectedLevel+1);else if(e.code==='Enter'||e.code==='Space')reset(selectedLevel);return;}
 if(state==='ended'){if(e.code==='Space')reset();return;}
 if(e.code==='Escape'||e.code==='KeyP'){if(state==='playing'||state==='countdown')pause();else if(state==='paused')startCountdown();return;}
 if(state==='upgrade'){if(/^Digit[123]$/.test(e.code))choose(Number(e.code.slice(-1))-1);return;}
 if(state!=='playing')return;
 keys.add(e.code);if(e.code==='Space'||e.code==='ArrowDown'||e.code==='KeyS')dash();
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();heldTouch.clear();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
for(const [id,action] of [['left-touch','left'],['right-touch','right'],['focus-touch','focus'],['dash-touch','dash']]){
 const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(action==='dash')dash();else heldTouch.add(action);});
 const release=e=>{e.preventDefault();heldTouch.delete(action);};el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',()=>heldTouch.delete(action));
}
// Small, read-only diagnostic surface for profiling an actual run (F3 toggles it).
const metrics={cpuMs:0,fps:0,maxEntities:0,maxParticles:0,frames:0};
Object.defineProperty(window,'downfall',{value:{get state(){return state;},get metrics(){return {...metrics,effects:effects.length,audioVoices:audio.active,music:audio.theme};},get run(){return run?{depth:run.depth,elapsed:run.elapsed,hp:player.hp,kills:run.kills,shards:run.shards,combo:run.combo,mutations:run.chosen.map(m=>m.id),bossHp:run.boss?.hp,bossId:run.boss?.id,bosses:run.cleared,bounces:run.bounces,grazes:run.nearCount,won:run.won}:null;},get scene(){return player?{width:W,height:H,player:{x:player.x,y:player.y,charges:player.charges,dashing:player.dashing,focus:player.focus,vx:player.vx,vy:player.vy,invuln:player.invuln},boss:run.boss?{x:run.boss.x,y:run.boss.y,hp:run.boss.hp,phase:run.boss.phase,attack:run.boss.attack?.kind}:null,objects:entities.map(e=>({type:e.type,kind:e.kind,x:e.x,y:e.y,w:e.w||0}))}:null;}}});
let sampleTime=0,sampleFrames=0,sampleCpu=0;
function frame(stamp){
 const realDt=last?Math.min((stamp-last)/1000,.04):1/60;last=stamp;const start=performance.now();
 update(realDt);
 if(state==='title'&&!reduced){
  if(titleTransition){
   const progress=clamp((time-titleTransition.start)/titleCrossingDuration,0,1);
   // Integral of a raised cosine speed pulse, with idle speed at both ends.
   const travel=progress-Math.sin(progress*TAU)/TAU;
   titleScroll=titleTransition.scrollStart+titleIdleSpeed*titleCrossingDuration*progress+
    (titleTransition.distance-titleIdleSpeed*titleCrossingDuration)*travel;
  }else titleScroll+=realDt*titleIdleSpeed;
 }
 render();const cost=performance.now()-start;
 sampleTime+=realDt;sampleFrames++;sampleCpu+=cost;metrics.frames++;metrics.maxEntities=Math.max(metrics.maxEntities,entities.length);metrics.maxParticles=Math.max(metrics.maxParticles,particles.length);
 if(sampleTime>=1){metrics.cpuMs=sampleCpu/sampleFrames;metrics.fps=Math.round(sampleFrames/sampleTime);if(metrics.cpuMs>13)quality=0;else if(metrics.cpuMs<6)quality=1;sampleTime=0;sampleFrames=0;sampleCpu=0;}
 requestAnimationFrame(frame);
}
if(!muted)audio.init();
updateSoundButton();
requestAnimationFrame(frame);
})();
