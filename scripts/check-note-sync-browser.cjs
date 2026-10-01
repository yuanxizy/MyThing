// Two real browser tabs sharing one isolated context; no user records touched.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
(async()=>{
 const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try {
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(()=>{
   if (!localStorage.getItem('one-tap-note.history')) {
    localStorage.setItem('one-tap-note.history','[]');
    localStorage.setItem('one-tap-note.note-type','all');
    localStorage.setItem('one-tap-note.bubble-counts',JSON.stringify({large:0,medium:0,small:20,micro:14}));
   }
   // Observe actual WebGL label texture drawing without replacing rendering.
   const labels = new Map();
   const getContext = HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext = function(type,...args){
    // A changed carrier count rebuilds the field; ignore disposed label textures.
    if (type==='webgl' || type==='webgl2' || type==='experimental-webgl') labels.clear();
    const result=getContext.call(this,type,...args);
    if(type==='2d' && this.width===512 && this.height===192 && result) labels.set(this,[]);
    return result;
   };
   const fill = CanvasRenderingContext2D.prototype.fillText;
   const clear = CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.fillText = function(text,...args){
    if(this.canvas.width===512 && this.canvas.height===192) {
     const lines=labels.get(this.canvas)||[];lines.push(String(text));labels.set(this.canvas,lines);
    }
    return fill.call(this,text,...args);
   };
   CanvasRenderingContext2D.prototype.clearRect = function(...args){
    if(this.canvas.width===512 && this.canvas.height===192) labels.set(this.canvas,[]);
    return clear.apply(this,args);
   };
   window.currentBubbleLabels=()=>[...labels.values()].map(lines=>lines.join('')).filter(Boolean);
   window.currentBubbleLabelSlots=()=>labels.size;
  });
  const bubbles=await context.newPage(), cards=await context.newPage();
  await bubbles.goto('http://127.0.0.1:4173/');
  await cards.goto('http://127.0.0.1:4173/cards');
  const save=async(page,text)=>{await page.getByRole('textbox',{name:'记录内容'}).fill(text);await page.getByRole('button',{name:'记好了',exact:true}).click();};
  const labelsInclude=async(text,present=true)=>bubbles.waitForFunction(({text,present})=>window.currentBubbleLabels().includes(text)===present,{text,present},{timeout:15000});
  const card=id=>cards.locator('.memory-card').filter({hasText:id});
  await save(bubbles,'急事：同步甲');
  await card('同步甲').waitFor();
  await labelsInclude('同步甲');
  assert.equal(await bubbles.evaluate(()=>window.currentBubbleLabelSlots()),1);
  await save(cards,'备忘：同步乙 #工作');
  await labelsInclude('同步乙');
  assert.equal(await bubbles.evaluate(()=>window.currentBubbleLabelSlots()),2);
  await card('同步乙').waitFor();
  assert.equal(await bubbles.evaluate(()=>JSON.parse(localStorage.getItem('one-tap-note.history')).length),2);
  await bubbles.getByRole('group',{name:'记事类型'}).getByRole('button',{name:'急事',exact:true}).click();
  await labelsInclude('同步乙',false);
  await cards.waitForTimeout(900);
  await card('同步甲').click();
  await cards.locator('.note-classification select').selectOption('memo');
  await labelsInclude('同步甲',false);
  await bubbles.getByRole('group',{name:'记事类型'}).getByRole('button',{name:'备忘',exact:true}).click();
  await labelsInclude('同步甲');
  await labelsInclude('同步乙');
  await card('同步甲').click();
  await cards.getByRole('button',{name:'删除卡片',exact:true}).click();
  await labelsInclude('同步甲',false);
  assert.equal(await card('同步甲').count(),0);
  await labelsInclude('同步乙');
  // Keep the remaining note in both views as the visual proof.
  await bubbles.screenshot({path:'D:/Projects/GPT/MyThing/shared-notes-bubbles.jpg'});
  await cards.screenshot({path:'D:/Projects/GPT/MyThing/shared-notes-cards.jpg'});
  await cards.reload();
  await card('同步乙').waitFor();
  assert.equal(await cards.locator('.memory-card').count(),1);
  await bubbles.getByRole('group',{name:'记事类型'}).getByRole('button',{name:'全部',exact:true}).click();
  for(let index=2;index<=10;index++) {
   await save(bubbles,`备忘：新增记事${index}`);
   await labelsInclude(`新增记事${index}`);
   assert.equal(await bubbles.evaluate(()=>window.currentBubbleLabelSlots()),index);
   assert.equal(await bubbles.evaluate(()=>window.currentBubbleLabels().length),index);
  }
  assert.deepEqual(await bubbles.evaluate(()=>JSON.parse(localStorage.getItem('one-tap-note.bubble-counts'))),{large:0,medium:0,small:20,micro:14});
  await bubbles.screenshot({path:'D:/Projects/GPT/MyThing/bubble-carriers-browser.jpg'});
  console.log('Passed real WebGL tabs: automatic carriers from 0 to 10 with all 34 decorative bubbles retained, no decorative label slots, cross-tab add/classification/filter/delete and persistence.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
