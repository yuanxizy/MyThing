// Native browser mouse input in isolated contexts, never the user's profile.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of [{ width:1815, height:1244 }, { width:1280, height:720 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => {
        if (localStorage.getItem('one-tap-note.history')) return;
        localStorage.setItem('one-tap-note.note-type', 'all');
        localStorage.setItem('one-tap-note.history', JSON.stringify([
          { id:'drag-urgent', title:'拖拽测试急事', text:'独立浏览器测试，不写入用户记事', noteType:'urgent', category:'', createdAt:'2026-10-01T10:00:00Z' },
          { id:'drag-memo', title:'拖拽测试备忘', text:'第二张独立测试卡片', noteType:'memo', category:'', createdAt:'2026-10-01T09:00:00Z' },
        ]));
      });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/cards');
      const source = page.locator('.memory-card').filter({ hasText:'拖拽测试急事' });
      await source.waitFor({state:'visible'});
      await page.waitForTimeout(900);
      const start = await source.boundingBox();
      const x = start.x + start.width / 2;
      const y = start.y + 25;
      await page.mouse.move(x,y);
      await page.mouse.down();
      await page.mouse.move(x+35,y+50,{steps:5});
      assert.equal(await page.locator('.memory-card--dragging').count(), 1);
      const slot = await page.locator('.card-focus-slot').boundingBox();
      assert.ok(slot.y >= 0 && slot.y + slot.height <= viewport.height, 'Drop slot must be visible during dragging');
      const endX = slot.x + slot.width / 2;
      // In compact windows the upper part overlaps the row: horizontal drags
      // intentionally sort there. Aim at the slot center to explicitly feature.
      const endY = viewport.height <= 980 ? slot.y + slot.height / 2 : slot.y - 12;
      await page.mouse.move(endX,endY,{steps:25});
      assert.equal(await page.locator('.card-focus-slot.is-over').count(), 1, 'Card center must activate the slot');
      const dragging = await source.boundingBox();
      assert.ok(Math.abs(dragging.x + dragging.width/2 - endX) < 2, 'Card follows the pointer');
      await page.mouse.up();
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.memory-card--featured .memory-card__title').textContent(), '拖拽测试急事');
      assert.equal(await page.locator('[role="dialog"]').count(), 0);
      assert.equal(await page.evaluate(()=>localStorage.getItem('one-tap-note.featured-card')), 'drag-urgent');
      const featuredPosition = await source.boundingBox();
      for (const [label, hangingCount] of [['备忘',1],['急事',0],['全部',1]]) {
        await page.getByRole('group',{name:'记事类型'}).getByRole('button',{name:label,exact:true}).click();
        assert.equal(await page.locator('.memory-card--featured').count(),1, 'C card always survives type filtering');
        assert.equal(await page.locator('.memory-card--featured .memory-card__title').textContent(),'拖拽测试急事');
        assert.equal(await page.locator('.memory-card:not(.memory-card--featured)').count(),hangingCount);
        const currentPosition = await source.boundingBox();
        assert.ok(Math.abs(currentPosition.x-featuredPosition.x)<1 && Math.abs(currentPosition.y-featuredPosition.y)<1, 'C card position stays fixed across filters');
      }
      await page.getByRole('group',{name:'记事类型'}).getByRole('button',{name:'备忘',exact:true}).click();
      await source.click();
      assert.equal(await page.locator('[role="dialog"] h2').textContent(),'拖拽测试急事', 'Cross-type C card stays clickable');
      await page.getByRole('button',{name:'关闭',exact:true}).click();
      const featuredBounds = await source.boundingBox();
      const composer = await page.locator('#note-composer').boundingBox();
      if (composer) assert.ok(featuredBounds.y + featuredBounds.height <= composer.y, 'Settled card stays above composer');
      if (viewport.height === 720 && process.env.DRAG_SCREENSHOT_PATH) await page.screenshot({path:process.env.DRAG_SCREENSHOT_PATH});
      await page.reload();
      await page.locator('.memory-card--featured').waitFor();
      assert.equal(await page.locator('.memory-card--featured .memory-card__title').textContent(), '拖拽测试急事');
      await context.close();
      console.log(`Passed C card ${viewport.width}x${viewport.height}: native drag, visibility and stable position across all types, empty hanging row, cross-type click and persistence.`);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
