// Real mouse input against the built app, using isolated test-only storage.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const key = 'one-tap-note.card-order';
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true, args:['--enable-unsafe-swiftshader']});
  try {
    for (const viewport of [{width:1815,height:1244}, {width:1280,height:720}]) {
      const context = await browser.newContext({viewport});
      await context.addInitScript(() => {
        if (localStorage.getItem('one-tap-note.history')) return;
        localStorage.setItem('one-tap-note.note-type','all');
        localStorage.setItem('one-tap-note.history',JSON.stringify(['A','B','C','D'].map((id,i)=>({id,title:`排序卡片 ${id}`,text:`拖拽排序测试 ${id}`,category:'',noteType:i%2?'memo':'urgent',createdAt:`2026-10-01T0${9-i}:00:00Z`}))));
      });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/cards');
      await page.locator('.memory-card').first().waitFor();
      await page.waitForTimeout(900);
      const card = id => page.locator('.memory-card').filter({hasText:`排序卡片 ${id}`});
      const order = () => page.evaluate(() => [...document.querySelectorAll('.memory-card:not(.memory-card--featured)')].sort((a,b)=>a.getBoundingClientRect().x-b.getBoundingClientRect().x).map(el=>el.querySelector('.memory-card__title').textContent));
      const startDrag = async(from,to) => {
        const a = await card(from).boundingBox(), b = await card(to).boundingBox();
        const y = a.y + 65;
        await page.mouse.move(a.x+a.width/2,y);
        await page.mouse.down();
        await page.mouse.move(b.x+b.width/2,y,{steps:24});
        assert.equal(await page.locator('.memory-rope-drop-marker').count(),1,'Insertion marker visible');
        assert.equal(await page.locator('.card-focus-slot.is-over').count(),0,'Horizontal sort must not feature a card');
      };
      assert.deepEqual(await order(), ['排序卡片 A','排序卡片 B','排序卡片 C','排序卡片 D']);
      await startDrag('A','D');
      if (viewport.height===1244 && process.env.SORT_SCREENSHOT_PATH) await page.screenshot({path:process.env.SORT_SCREENSHOT_PATH});
      await page.mouse.up();
      await page.waitForTimeout(900);
      assert.deepEqual(await order(),['排序卡片 B','排序卡片 C','排序卡片 D','排序卡片 A']);
      assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),['B','C','D','A']);
      assert.equal(await page.locator('[role="dialog"]').count(),0);
      assert.equal(await page.locator('.memory-card--featured').count(),0);
      const historyBefore = await page.evaluate(()=>localStorage.getItem('one-tap-note.history'));
      await page.reload();
      await page.locator('.memory-card').first().waitFor();
      await page.waitForTimeout(900);
      assert.deepEqual(await order(),['排序卡片 B','排序卡片 C','排序卡片 D','排序卡片 A']);
      await page.getByRole('group',{name:'记事类型'}).getByRole('button',{name:'急事',exact:true}).click();
      await page.waitForTimeout(900);
      await startDrag('A','C');
      await page.mouse.up();
      await page.waitForTimeout(900);
      assert.deepEqual(await order(),['排序卡片 A','排序卡片 C']);
      assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)),['B','A','D','C'],'Hidden cards keep their overall slots');
      await page.getByRole('group',{name:'记事类型'}).getByRole('button',{name:'全部',exact:true}).click();
      await page.waitForTimeout(900);
      await startDrag('B','C');
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await page.waitForTimeout(900);
      assert.deepEqual(await order(),['排序卡片 B','排序卡片 A','排序卡片 D','排序卡片 C']);
      assert.equal(await page.evaluate(()=>localStorage.getItem('one-tap-note.history')),historyBefore,'Sorting never rewrites note metadata');
      await page.getByRole('textbox',{name:'记录内容'}).fill('备忘：新增排序测试');
      await page.getByRole('button',{name:'记好了',exact:true}).click();
      await page.waitForTimeout(1100);
      const next = await order();
      assert.ok(next[0].includes('新增排序测试'));
      assert.deepEqual(next.slice(1),['排序卡片 B','排序卡片 A','排序卡片 D','排序卡片 C']);
      await context.close();
      console.log(`Passed native reorder ${viewport.width}x${viewport.height}: preview, commit, persistence, filtered sorting, Escape, newest insertion and preserved metadata.`);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
