// にっぽん都道府県マスター 検証スクリプト（仕様書26章の確認項目）
const fs=require('fs'),path=require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
// 使い方: node tools/verify.cjs [index.html] [比較用の元index.html(任意)] [スクショ保存先]
//   ※ Playwright が必要: npm i -g playwright
const FILE=path.resolve(process.argv[2]||'index.html'), ORIG=process.argv[3]?path.resolve(process.argv[3]):null;
const SHOT=process.argv[4]||'verify-shots';fs.mkdirSync(SHOT,{recursive:true});
let fails=0;const ok=(c,m)=>{console.log((c?'  ✅ ':'  ❌ ')+m);if(!c)fails++};
const html=fs.readFileSync(FILE,'utf8');
const EXPECT=[["北海道","ほっかいどう"],["青森県","あおもりけん"],["岩手県","いわてけん"],["宮城県","みやぎけん"],["秋田県","あきたけん"],["山形県","やまがたけん"],["福島県","ふくしまけん"],["茨城県","いばらきけん"],["栃木県","とちぎけん"],["群馬県","ぐんまけん"],["埼玉県","さいたまけん"],["千葉県","ちばけん"],["東京都","とうきょうと"],["神奈川県","かながわけん"],["新潟県","にいがたけん"],["富山県","とやまけん"],["石川県","いしかわけん"],["福井県","ふくいけん"],["山梨県","やまなしけん"],["長野県","ながのけん"],["岐阜県","ぎふけん"],["静岡県","しずおかけん"],["愛知県","あいちけん"],["三重県","みえけん"],["滋賀県","しがけん"],["京都府","きょうとふ"],["大阪府","おおさかふ"],["兵庫県","ひょうごけん"],["奈良県","ならけん"],["和歌山県","わかやまけん"],["鳥取県","とっとりけん"],["島根県","しまねけん"],["岡山県","おかやまけん"],["広島県","ひろしまけん"],["山口県","やまぐちけん"],["徳島県","とくしまけん"],["香川県","かがわけん"],["愛媛県","えひめけん"],["高知県","こうちけん"],["福岡県","ふくおかけん"],["佐賀県","さがけん"],["長崎県","ながさきけん"],["熊本県","くまもとけん"],["大分県","おおいたけん"],["宮崎県","みやざきけん"],["鹿児島県","かごしまけん"],["沖縄県","おきなわけん"]];
const REG={"北海道":[1],"東北":[2,7],"関東":[8,14],"中部":[15,24],"近畿":[25,30],"中国":[31,35],"四国":[36,39],"九州・沖縄":[40,47]};
(async()=>{
console.log('■ 静的チェック');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let syntax=true;try{scripts.forEach(s=>new Function(s))}catch(e){syntax=false;console.log(e)}
ok(syntax,'JavaScript構文 (new Function)');
ok(/^<!doctype html>/i.test(html)&&(html.match(/<html/g)||[]).length===1&&html.trim().endsWith('</html>'),'HTML構造（doctype/html 1つ/閉じタグ）');
const re=/const MAP_SVG\s*=\s*"(?:[^"\\]|\\.)*"/;
ok(!!re.exec(html),'地図SVG（MAP_SVG）が存在');
if(ORIG)ok(re.exec(html)[0]===re.exec(fs.readFileSync(ORIG,'utf8'))[0],'地図SVG（MAP_SVG）が比較元と完全一致');
const ids=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
const refs=[...new Set([...scripts.join('').matchAll(/(?:\$|getElementById)\("([^"]+)"\)/g)].map(m=>m[1]))];
const missing=refs.filter(r=>!ids.has(r));ok(!missing.length,`JSが参照するIDがすべてHTMLに存在（${refs.length}件）`+(missing.length?' 不足:'+missing:''));
ok(ids.has('japanMap')&&ids.has('quizMap'),'#japanMap / #quizMap が存在');
ok(!/<script[^>]+src=/.test(html)&&!/<link[^>]+stylesheet/.test(html),'外部JS/CSSの読み込みなし');

const b=await chromium.launch();
async function open(vp,pre){const ctx=await b.newContext({viewport:vp,deviceScaleFactor:2,hasTouch:vp.width<800});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  if(pre)await p.addInitScript(pre);await p.goto('file://'+FILE);await p.waitForTimeout(250);return{p,errs,ctx}}
const inView=async(p,sel)=>p.$$eval(sel,(els)=>els.map(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<=innerHeight+0.5&&r.left>=0&&r.right<=innerWidth+0.5}));

console.log('■ 基本動作（PC 1280x800）');
{const{p,errs,ctx}=await open({width:1280,height:800});
ok(await p.evaluate(()=>typeof loadJapanMaps==='function'&&typeof renderLearn==='function'&&typeof mapPaint==='function'),'loadJapanMaps / renderLearn / mapPaint が存在');
ok(await p.$$eval('#japanMap .prefecture',e=>e.length)===47&&await p.$$eval('#quizMap .prefecture',e=>e.length)===47,'両方の地図に47都道府県');
const codes=await p.$$eval('#japanMap .prefecture',e=>e.map(x=>x.getAttribute('data-code')).sort((a,b)=>a-b).join(','));ok(codes===Array.from({length:47},(_,i)=>i+1).join(','),'data-code は 1〜47（ゼロ埋めなし）');
ok(await p.$$eval('#japanMap .prefecture',e=>e.every(x=>x.getAttribute('tabindex')==='0'&&x.getAttribute('role')==='button')),'覚える地図: tabindex=0 / role=button');
ok(await p.$$eval('#quizMap .prefecture title',e=>e.length)===0,'答える地図: 県名ツールチップなし（答えが見えない）');
let all=[];for(let i=0;i<47;i++){all.push(await p.evaluate(()=>[learnName.textContent,learnRuby.textContent,learnNumber.textContent,document.querySelectorAll('#japanMap .prefecture.target').length,document.querySelector('#japanMap .prefecture.target')?.getAttribute('data-code')]));if(i<46)await p.click('#nextBtn')}
ok(all.every((x,i)=>x[0]===EXPECT[i][0]&&x[1]===EXPECT[i][1]),'47県すべて 県名とふりがなが正しく連動');
ok(all.every((x,i)=>x[2]===String(i+1).padStart(2,'0')&&x[3]===1&&x[4]===String(i+1)),'番号表示・地図ハイライト（1県だけ）が連動');
await p.click('#nextBtn');ok(await p.isVisible('#modal'),'最後の県で「つぎ」→ クリア画面');
await p.click('#modal .btn-ghost >> nth=-1');ok(await p.evaluate(()=>learnName.textContent)==='北海道','「もういちど」で最初に戻る');
for(const[k,[a,z]] of Object.entries(REG)){await p.click(`#regionChips [data-r="${k}"]`);const got=[];const n=(z||a)-a+1;for(let i=0;i<n;i++){got.push(await p.evaluate(()=>learnNumber.textContent));if(i<n-1)await p.click('#nextBtn')}
 ok(got.join()===Array.from({length:n},(_,i)=>String(a+i).padStart(2,'0')).join(),`地方「${k}」の学習順 ${got[0]}〜${got[got.length-1]}`)}
await p.click('#regionChips [data-r="全国"]');
await p.click('#japanMap .prefecture[data-code="23"]');ok(await p.evaluate(()=>learnName.textContent)==='愛知県','地図の県をクリック → その県へ');
await p.focus('#japanMap .prefecture[data-code="13"]');await p.keyboard.press('Enter');ok(await p.evaluate(()=>learnName.textContent)==='東京都','地図の県でEnterキー → その県へ');
// 4択
const bad=await p.evaluate(()=>{const r=[];for(const reg of REGION_LIST)for(const t of reg.codes){for(let k=0;k<5;k++){const c=nearestChoices(t,reg.codes);if(c.length!==3||new Set(c).size!==3||c.includes(t))r.push(reg.key+t)}}return r});
ok(!bad.length,'全地方×全県で 4択が重複なし・正解を含まない3つの選択肢'+(bad.length?bad.slice(0,5):''));
const aichi=await p.evaluate(()=>{const s=new Set();for(let i=0;i<50;i++)nearestChoices(23,ALL.codes).forEach(c=>s.add(c));return[...s].sort((a,b)=>a-b)});
ok(aichi.every(c=>[20,21,22,24].includes(c)),'愛知県の選択肢はとなりの県（岐阜・静岡・三重・長野）から: '+aichi);
await p.click('.tab[data-mode="quiz"]');
for(const order of['number','random']){await p.click(`#orderChips [data-order="${order}"]`);
 for(const k of Object.keys(REG)){await p.click(`#regionChips [data-r="${k}"]`);const n=await p.evaluate(()=>round.deck.length);const seen=[];
  for(let i=0;i<n;i++){const t=await p.evaluate(()=>round.target);seen.push(t);const btns=await p.$$eval('#answers .answer',e=>e.map(x=>+x.dataset.code));if(btns.length!==4||!btns.includes(t)){ok(false,`${k} 選択肢数 ${btns.length}`)}
   const hl=await p.$$eval('#quizMap .prefecture.target',e=>e.map(x=>+x.dataset.code));if(hl.length!==1||hl[0]!==t)ok(false,'クイズのハイライト不一致');
   await p.click(`#answers .answer[data-code="${i%3?t:btns.find(c=>c!==t)}"]`);await p.click('#nextQuestion');}
  const uniq=new Set(seen).size===seen.length;ok(await p.isVisible('#modal')&&uniq&&(order==='random'||seen.join()===REG[k].length&&false||true),`答える(${order})「${k}」: ${n}問・同じ県の重複なし・結果画面`);
  if(order==='number'){const[a,z]=REG[k];ok(seen.join()===Array.from({length:(z||a)-a+1},(_,i)=>a+i).join(),`  ナンバリング順 ${seen[0]}→${seen[seen.length-1]}`)}
  await p.keyboard.press('Escape');}}
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem('jpMaster')));ok(st.total>0&&st.correct<=st.total&&st.mastered.length>0,'学習記録が localStorage に保存');
await p.reload();await p.waitForTimeout(200);ok(await p.evaluate(()=>+learnedCount.textContent)>0,'再読み込み後も学習状況を維持');
await p.click('.tab[data-mode="learn"]');await p.click('#regionChips [data-r="全国"]');
await p.screenshot({path:SHOT+'/pc-learn.png'});
await p.click('#japanMap .prefecture[data-code="37"]');await p.waitForTimeout(600);await p.screenshot({path:SHOT+'/pc-learn-shikoku.png'});
await p.click('.tab[data-mode="quiz"]');await p.click('#regionChips [data-r="全国"]');await p.waitForTimeout(600);await p.screenshot({path:SHOT+'/pc-quiz.png'});
const t=await p.evaluate(()=>round.target);await p.click(`#answers .answer[data-code="${t}"]`);await p.waitForTimeout(250);await p.screenshot({path:SHOT+'/pc-quiz-correct.png'});
await p.evaluate(()=>window.scrollTo(0,99999));await p.waitForTimeout(100);await p.screenshot({path:SHOT+'/pc-records.png'});
ok(!errs.length,'JSエラーなし (PC)'+(errs.length?errs:''));await ctx.close();}

console.log('■ 旧データの移行・壊れたデータ');
{const{p,errs,ctx}=await open({width:1280,height:800},()=>localStorage.setItem('jpMaster','{"seen":[1,2,3],"correct":5,"total":8,"streak":2,"best":4}'));
ok(await p.evaluate(()=>[learnedCount.textContent,accuracy.textContent,streak.textContent].join())==='3,63%,2','旧形式 {seen,...} を引き継ぎ（学習3・正解率63%・2連続）');ok(!errs.length,'JSエラーなし');await ctx.close();}
{const{p,errs,ctx}=await open({width:1280,height:800},()=>localStorage.setItem('jpMaster','{broken'));
ok(await p.evaluate(()=>learnName.textContent)==='北海道'&&!errs.length,'壊れた保存データでも起動する');await ctx.close();}

for(const vp of [{width:412,height:915,name:'pixel9a'},{width:412,height:780,name:'pixel9a-browserbars'},{width:360,height:640,name:'small'}]){
 console.log(`■ スマホ ${vp.name} ${vp.width}x${vp.height}`);
 const{p,errs,ctx}=await open(vp);
 ok((await inView(p,'#japanMap svg, #learnName, #learnRuby, #prevBtn, #nextBtn, #mobileMenuButton')).every(Boolean),'覚える: 地図・県名・ふりがな・まえ/つぎ・☰ が1画面に収まる');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'横スクロールなし');
 ok(!(await p.isVisible('.brand'))&&!(await p.isVisible('.stats'))&&!(await p.isVisible('.controls'))&&!(await p.isVisible('#learnFact'))&&!(await p.isVisible('#records')),'大きなヘッダー・統計・地方選択・補足説明・記録を非表示');
 const mapH=await p.$eval('#japanMap',e=>e.getBoundingClientRect().height);ok(mapH>=150,'地図の高さ '+Math.round(mapH)+'px');
 await p.screenshot({path:`${SHOT}/m-${vp.name}-learn.png`});
 await p.click('#mobileMenuButton');await p.waitForTimeout(300);ok(await p.isVisible('#menuRegions'),'☰ でメニュー表示');await p.screenshot({path:`${SHOT}/m-${vp.name}-menu.png`});
 await p.click('#menuRegions [data-menu-region="東北"]');await p.waitForTimeout(500);ok(await p.evaluate(()=>learnName.textContent)==='青森県'&&!(await p.isVisible('#menuRegions')),'メニューで地方選択 → 東北・青森県から');
 await p.screenshot({path:`${SHOT}/m-${vp.name}-learn-tohoku.png`});
 await p.click('#mobileMenuButton');await p.click('[data-menu-mode="quiz"]');await p.waitForTimeout(500);
 ok((await inView(p,'#quizMap svg, #answers .answer, #quizProgress')).every(Boolean),'答える: 地図・4択・問題数 が1画面に収まる（東北）');
 await p.screenshot({path:`${SHOT}/m-${vp.name}-quiz.png`});
 const t=await p.evaluate(()=>round.target);const wrong=await p.$$eval('#answers .answer',(e,t)=>+e.map(x=>x.dataset.code).find(c=>+c!==t),t);
 await p.click(`#answers .answer[data-code="${wrong}"]`);await p.waitForTimeout(300);
 ok((await inView(p,'#nextQuestion, #answers .answer, #feedback')).every(Boolean),'回答後: 正誤表示と「つぎの問題」も画面内');
 await p.screenshot({path:`${SHOT}/m-${vp.name}-quiz-wrong.png`});
 await p.click('#nextQuestion');const t2=await p.evaluate(()=>round.target);await p.click(`#answers .answer[data-code="${t2}"]`);
 await p.click('#mobileMenuButton');ok(await p.evaluate(()=>[menuAccuracy.textContent,menuStreak.textContent].join())==='50%,1','メニューの学習状況が回答に合わせて更新');
 await p.click('#menuOrder [data-menu-order="random"]');ok(await p.evaluate(()=>state.order==='random'&&round.order==='random'),'メニューから出題方式を変更できる');
 await p.click('#mobileMenuButton');await p.click('#openRecords');await p.waitForTimeout(200);ok(await p.isVisible('#recordSummary'),'メニューから きろく を開ける');await p.screenshot({path:`${SHOT}/m-${vp.name}-records.png`});
 await p.click('#recordsClose');
 ok(!errs.length,'JSエラーなし'+(errs.length?errs:''));await ctx.close();
}
await b.close();
console.log(fails?`\n結果: ❌ ${fails}件 失敗`:'\n結果: ✅ すべて合格');process.exit(fails?1:0);
})();
