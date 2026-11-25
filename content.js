/* Original encounters and score for DOWNFALL. Pure data, available offline. */
window.DownfallContent = {
 balance:{
  worldUnitsPerMeter:20,fallSpeed:130,gravity:500,
  dashSpeed:520,dashDuration:.18,fangSpeed:20,fangDuration:.015,
  startHp:4,maxHp:6,startCharges:2,maxCharges:4,recharge:4.5,
  hurtGrace:.75,bounceGrace:.12,bossHitGrace:.24,
  springJump:300,prismJump:260,flowJump:330,rockJump:235,enemyJump:210,bossJump:215,objectBounces:3,
  focusRegen:1.8,focusDrain:32,focusOnKill:3,focusOnGem:.5,
  healDropChance:.035,magnetHealEvery:30,bloomHealEvery:5,vampireHealEvery:12,nearHealEvery:8,
  wardCooldown:18,leechCost:65,upgradeFocus:15,bossRewardHeal:1
 },
 bosses:[
  {id:'bell',name:'ДЗВОНАР',depth:500,hp:10,color:'#a9e5cc',subtitle:'Уникай звукових стовпів · Ривок у світле ядро',attacks:['peal','columns','peal','resonance']},
  {id:'mother',name:'СПОРОВА МАТІР',depth:1000,hp:14,color:'#d9a7ef',subtitle:'Облітай спори · Пробивай серцевину',attacks:['spores','seeds','brood','spores']},
  {id:'forge',name:'СЕРЦЕ КУЗНІ',depth:1500,hp:18,color:'#ffb879',subtitle:'Шукай прохід у вогні · Ривок у ядро',attacks:['lances','firewall','spiral','meteors']}
 ],
 enemies:[['moth','eye','sentinel'],['jelly','spore','stalker'],['wisp','beetle','turret']],
 music:{
  title:{name:'Над прірвою',bpm:76,root:45,chords:[0,5,8,3],arp:[0,7,12,3,10,7,15,12],lead:[12,-1,-1,7,-1,10,-1,-1,15,-1,12,-1,10,-1,-1,-1],pad:true},
  temple:{name:'Камінь і вода',bpm:104,root:45,chords:[0,5,8,7],arp:[0,7,12,15,7,10,3,12],lead:[12,-1,15,-1,19,-1,15,12,-1,10,-1,7,10,-1,7,-1],hat:4},
  grove:{name:'Пульс грибниці',bpm:116,root:42,chords:[0,3,7,5],arp:[0,3,10,7,15,12,7,3],lead:[19,-1,-1,15,12,-1,10,-1,15,12,-1,10,7,-1,10,-1],hat:2},
  forge:{name:'Попіл і мідь',bpm:128,root:38,chords:[0,1,5,7],arp:[0,7,12,1,7,13,5,12],lead:[12,13,-1,12,7,-1,5,-1,12,-1,13,17,19,-1,17,13],hat:2},
  bell:{name:'Дзвін у глибині',bpm:124,root:38,chords:[0,5,3,7],arp:[0,12,7,15,12,19,7,10],lead:[24,-1,19,-1,15,-1,19,-1,22,-1,19,15,12,-1,10,-1],hat:2,boss:true},
  mother:{name:'Тисяча спор',bpm:136,root:42,chords:[0,3,1,7],arp:[0,3,7,10,12,15,19,10],lead:[19,15,-1,12,10,-1,15,19,22,-1,19,15,13,12,-1,10],hat:1,boss:true},
  heart:{name:'Останній жар',bpm:144,root:38,chords:[0,1,8,7],arp:[0,7,12,13,19,12,7,1],lead:[24,-1,19,24,25,-1,24,19,20,19,-1,17,13,12,13,19],hat:1,boss:true}
 },
 spriteRows:{
  sentinel:['   aaa   ','  abbba  ',' abcccba ',' abdedba ','abcdddcba','abcccccba',' abfefba ','  abbba  ','  a a a  ',' a  a  a '],
  spore:['    aaa    ','  aabbbaa  ',' abcbcbcba ','abbbdbbbbba','abdddddddba',' abbbbbbba ','   aeeea   ','   aeeea   ','  aeaeaea  ',' a a a a a '],
  stalker:[' a       a ',' aa     aa ',' abbaaabba ',' abbccc bba','abcdeedcba ',' abccccba  ','  abbbba   ','  a ab a   ',' a  ab  a  ','a   a    a '],
  wisp:['     a    ','    aba   ','   abba   ','  abbba a ',' abcccbba ','abcdddcba ',' abdedba  ',' abcccba  ','  ab bba  ','   a  a   '],
  beetle:['  a     a  ','   abbba   ','  abcccba  ',' abcccccba ','abcddeddcba','abccddcccba',' abcccccba ','a abbbbba a',' a a a a a ','a  a a a  a'],
  turret:['    aaa    ','   abbba   ',' aabcccbaa ',' abccdccba ',' abcdedcba ',' abccdccba ','  abcccba  ','  aabbbaa  ',' abbbbb b a',' aaaaaaaa  ']
 }
};
