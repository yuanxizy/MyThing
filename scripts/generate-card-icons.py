"""Generate the original Yike card icon assets, manifest and preview catalog."""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "icons" / "cards"
DEST.mkdir(parents=True, exist_ok=True)

# Every icon shares a 64 px canvas, rounded 2.4 px strokes and a soft duotone fill.
CATEGORIES = [
    ("inspiration", "灵感", "#AC7B27", "#F6E7BD", [
        ("idea", "灵光一现", "想法、创意、突然想到的点子", '''<path d="M24 43c0-4-8-7-8-17a16 16 0 0 1 32 0c0 10-8 13-8 17Z" fill="SOFT"/><path d="M24 43c0-4-8-7-8-17a16 16 0 0 1 32 0c0 10-8 13-8 17M24 43h16M25 49h14M28 55h8"/><path d="M27 31l5 5 5-5M32 36v7M32 4v3M7 24h4M53 24h4M12 9l3 3M52 9l-3 3"/><path d="M22 23c1-4 4-7 8-7" stroke-opacity=".55"/>'''),
        ("spark", "灵感火花", "脑暴、突破、新的方向", '''<path d="m36 7-21 28h15l-2 22 21-30H34Z" fill="SOFT"/><path d="m36 7-21 28h15l-2 22 21-30H34Z"/><path d="m10 12 2 2M8 24h4M49 48l3 3M52 39h4" stroke-opacity=".6"/>'''),
        ("shooting-star", "奇妙发现", "新发现、值得尝试的事", '''<path d="m43 8 3.5 8 8.5 1-6.4 5.7 1.8 8.3-7.4-4.2-7.4 4.2 1.8-8.3-6.4-5.7 8.5-1Z" fill="SOFT"/><path d="m43 8 3.5 8 8.5 1-6.4 5.7 1.8 8.3-7.4-4.2-7.4 4.2 1.8-8.3-6.4-5.7 8.5-1ZM31 30 12 49M36 38 21 53M24 24 8 40"/><circle cx="12" cy="14" r="2" fill="INK" stroke="none"/>'''),
        ("sprout", "想法萌芽", "待发展的小想法、长期创作", '''<path d="M31 37C14 38 9 25 11 15c15 0 23 8 20 22ZM33 31c-2-13 8-20 21-20 1 12-6 21-21 20Z" fill="SOFT"/><path d="M31 37C14 38 9 25 11 15c15 0 23 8 20 22ZM33 31c-2-13 8-20 21-20 1 12-6 21-21 20ZM20 24c8 7 12 13 12 20v10M45 20 33 32M22 55h20"/>'''),
    ]),
    ("excerpt", "摘录", "#627AB5", "#E1E8F8", [
        ("quote", "金句摘录", "引用、金句、对话片段", '''<path d="M10 17h18v17c0 9-5 15-13 17l-2-6c5-2 7-5 7-10H10ZM36 17h18v17c0 9-5 15-13 17l-2-6c5-2 7-5 7-10H36Z" fill="SOFT"/><path d="M10 17h18v17c0 9-5 15-13 17l-2-6c5-2 7-5 7-10H10ZM36 17h18v17c0 9-5 15-13 17l-2-6c5-2 7-5 7-10H36Z"/>'''),
        ("book", "阅读笔记", "读书摘录、学习笔记", '''<path d="M32 18c-7-5-15-6-23-3v34c8-3 16-2 23 3 7-5 15-6 23-3V15c-8-3-16-2-23 3Z" fill="SOFT"/><path d="M32 18c-7-5-15-6-23-3v34c8-3 16-2 23 3 7-5 15-6 23-3V15c-8-3-16-2-23 3ZM32 18v34M16 25c3-1 6 0 9 1M16 33c3-1 6 0 9 1M39 26c3-1 6-2 9-1M39 34c3-1 6-2 9-1"/>'''),
        ("bookmark", "收藏片段", "文章收藏、想回看的内容", '''<path d="M19 10h26a3 3 0 0 1 3 3v42L32 45 16 55V13a3 3 0 0 1 3-3Z" fill="SOFT"/><path d="M19 10h26a3 3 0 0 1 3 3v42L32 45 16 55V13a3 3 0 0 1 3-3ZM24 22h16M24 29h11"/>'''),
        ("highlight", "重点标记", "关键段落、重要信息", '''<path d="m19 36 23-23 10 10-23 23-10 2-2-2Z" fill="SOFT"/><path d="m19 36 23-23 10 10-23 23-10 2-2-2ZM36 19l10 10M19 36l10 10M13 48l-4 6h17M33 54h21"/><path d="m27 33 10-10" stroke-opacity=".5"/>'''),
    ]),
    ("life", "生活", "#BE795F", "#F7E3D9", [
        ("coffee", "日常小事", "吃喝、日常、轻松时刻", '''<path d="M13 25h31v14c0 9-6 14-15.5 14S13 48 13 39Z" fill="SOFT"/><path d="M13 25h31v14c0 9-6 14-15.5 14S13 48 13 39ZM44 28h4a8 8 0 0 1 0 16h-5M10 57h40M21 17c-5-5 5-7 0-12M32 17c-5-5 5-7 0-12"/>'''),
        ("home", "家的记忆", "家庭、居家、亲友", '''<path d="M14 29 32 13l18 16v24H14Z" fill="SOFT"/><path d="m8 32 24-22 24 22M14 29v24h36V29M26 53V38h12v15M42 13v-3h7v10"/><path d="M20 32h4" stroke-opacity=".6"/>'''),
        ("leaf", "自然与健康", "散步、健康、植物、户外", '''<path d="M16 44C5 25 23 12 52 10c0 30-17 48-36 34Z" fill="SOFT"/><path d="M16 44C5 25 23 12 52 10c0 30-17 48-36 34ZM10 54l30-30M22 42l-1-11M29 35h12"/>'''),
        ("sun", "美好一天", "心情、旅行、值得纪念的日子", '''<circle cx="32" cy="32" r="14" fill="SOFT"/><circle cx="32" cy="32" r="14"/><path d="M32 6v6M32 52v6M6 32h6M52 32h6M13 13l4 4M47 47l4 4M13 51l4-4M47 17l4-4"/><path d="M27 37c3 3 7 3 10 0"/><circle cx="27" cy="29" r="1.3" fill="INK" stroke="none"/><circle cx="37" cy="29" r="1.3" fill="INK" stroke="none"/>'''),
    ]),
    ("work", "工作", "#4D8D87", "#DCEFEA", [
        ("briefcase", "工作事项", "项目、业务、工作备忘", '''<rect x="9" y="21" width="46" height="31" rx="6" fill="SOFT"/><rect x="9" y="21" width="46" height="31" rx="6"/><path d="M23 21v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7M9 32c14 7 32 7 46 0"/><rect x="28" y="31" width="8" height="10" rx="2" fill="SOFT"/>'''),
        ("checklist", "待办清单", "任务、行动项、检查记录", '''<rect x="13" y="12" width="38" height="44" rx="5" fill="SOFT"/><rect x="13" y="12" width="38" height="44" rx="5"/><rect x="25" y="8" width="14" height="8" rx="3" fill="SOFT"/><path d="m20 28 3 3 5-6M33 29h10m-23 13 3 3 5-6M33 43h10"/>'''),
        ("calendar", "日程安排", "会议、预约、截止日期", '''<rect x="10" y="15" width="44" height="39" rx="6" fill="SOFT"/><rect x="10" y="15" width="44" height="39" rx="6"/><path d="M10 27h44M22 9v12M42 9v12"/><rect x="18" y="34" width="7" height="7" rx="2" fill="INK" stroke="none"/><path d="M33 37h11M21 47h3M34 47h10" stroke-opacity=".65"/>'''),
        ("target", "目标计划", "目标、里程碑、推进方向", '''<circle cx="29" cy="35" r="21" fill="SOFT"/><circle cx="29" cy="35" r="21"/><circle cx="29" cy="35" r="12"/><circle cx="29" cy="35" r="3" fill="INK" stroke="none"/><path d="m29 35 20-20M49 15v-7l7 1 1 7h-8"/>'''),
    ]),
    ("private", "私密", "#8C73A8", "#EBE2F3", [
        ("lock", "私密记事", "只想留给自己的记录", '''<rect x="13" y="27" width="38" height="29" rx="6" fill="SOFT"/><rect x="13" y="27" width="38" height="29" rx="6"/><path d="M22 27V19a10 10 0 0 1 20 0v8"/><circle cx="32" cy="39" r="3" fill="INK" stroke="none"/><path d="M32 42v6"/>'''),
        ("key", "重要凭记", "个人线索、重要的私密提示", '''<path d="M32 24a12 12 0 1 0-8 12l7 7h7v7h7v6h9V45Z" fill="SOFT"/><path d="M32 24a12 12 0 1 0-8 12l7 7h7v7h7v6h9V45Z"/><circle cx="18" cy="22" r="3.5"/><path d="m34 34 12 12" stroke-opacity=".5"/>'''),
        ("shield", "隐私保护", "边界、安全、隐私相关提醒", '''<path d="M32 8c7 5 14 7 21 8v15c0 12-8 19-21 25C19 50 11 43 11 31V16c7-1 14-3 21-8Z" fill="SOFT"/><path d="M32 8c7 5 14 7 21 8v15c0 12-8 19-21 25C19 50 11 43 11 31V16c7-1 14-3 21-8Z"/><path d="m22 32 7 7 14-15"/>'''),
        ("diary", "内心日记", "心事、情绪、个人日记", '''<rect x="13" y="10" width="36" height="46" rx="5" fill="SOFT"/><rect x="13" y="10" width="36" height="46" rx="5"/><path d="M20 10v46M10 20h6M10 30h6M10 40h6M10 50h6"/><path d="M35 26c-5-6-11 1-6 6l6 6 6-6c5-5-1-12-6-6Z" fill="SOFT"/><path d="M48 29h7v11h-7" fill="SOFT"/>'''),
    ]),
]

manifest = []
sections = []
for category, label, ink, soft, icons in CATEGORIES:
    entries = []
    cards = []
    for name, title, meaning, shape in icons:
        icon_id = f"{category}-{name}"
        filename = f"{icon_id}.svg"
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="{ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-labelledby="title"><title id="title">{title}</title>{shape.replace("SOFT", soft).replace("INK", ink)}</svg>'''
        (DEST / filename).write_text(svg + "\n", encoding="utf-8")
        entries.append({"id": icon_id, "name": title, "meaning": meaning, "src": f"/icons/cards/{filename}"})
        cards.append(f'''<a class="icon-card" href="./{filename}" download="{filename}" aria-label="下载{title} SVG"><div class="icon-stage"><img src="./{filename}" width="64" height="64" alt="{title}"/></div><strong>{title}</strong><span>{meaning}</span><div class="small-sizes" aria-hidden="true"><img src="./{filename}" width="16" height="16"/><img src="./{filename}" width="24" height="24"/><img src="./{filename}" width="32" height="32"/><small>16 / 24 / 32</small></div></a>''')
    manifest.append({"id": category, "name": label, "color": ink, "softColor": soft, "icons": entries})
    sections.append(f'''<section style="--ink:{ink};--soft:{soft}"><div class="section-heading"><h2>{label}</h2><span>04 ICONS</span></div><div class="grid">{"".join(cards)}</div></section>''')

(DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(ROOT / "src" / "cardIcons.ts").write_text('''// Generated by scripts/generate-card-icons.py; original Yike vector artwork.
export const CARD_ICON_CATEGORIES = ''' + json.dumps(manifest, ensure_ascii=False, indent=2) + ''' as const;

export type CardIconCategory = typeof CARD_ICON_CATEGORIES[number]["id"];
export type CardIconId = typeof CARD_ICON_CATEGORIES[number]["icons"][number]["id"];
export const CARD_ICONS = CARD_ICON_CATEGORIES.flatMap((category) => [...category.icons]);
export function getCardIcon(id: CardIconId) {
  return CARD_ICONS.find((icon) => icon.id === id)!;
}
''', encoding="utf-8")

preview = '''<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>一刻 · 卡片图标资源</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f8f7f3;color:#303a37;font-family:Inter,"Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}main{max-width:1120px;margin:auto;padding:64px 40px 48px}header{margin-bottom:48px}.eyebrow{font-size:11px;letter-spacing:3px;color:#808b82}h1{font-size:36px;letter-spacing:-1px;margin:14px 0}header p{font-size:14px;color:#7b857f;line-height:1.8;margin:0}.meta{display:flex;gap:8px;margin-top:22px}.meta span{padding:6px 11px;background:#eceee7;border-radius:20px;font-size:11px;color:#66766a}section{margin:30px 0}.section-heading{display:flex;align-items:center;gap:12px;margin-bottom:14px}h2{font-size:17px;color:var(--ink);margin:0}.section-heading>span{font-size:9px;letter-spacing:2px;color:#929991}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.icon-card{display:flex;flex-direction:column;padding:19px;background:#fff;border:1px solid #e9eae2;border-radius:16px;color:inherit;text-decoration:none;transition:transform .2s,box-shadow .2s}.icon-card:hover{transform:translateY(-3px);box-shadow:0 8px 25px #34463a0d}.icon-card:focus-visible{outline:2px solid var(--ink);outline-offset:3px}.icon-stage{height:88px;display:grid;place-items:center;background:linear-gradient(135deg,var(--soft),#fff);border-radius:11px;margin-bottom:15px}.icon-card strong{font-size:13px;font-weight:600}.icon-card>span{font-size:11px;line-height:1.5;color:#8a938c;margin-top:7px;min-height:33px}.small-sizes{display:flex;align-items:center;gap:10px;border-top:1px solid #f0f1ea;margin-top:12px;padding-top:12px}.small-sizes small{font-size:9px;color:#a0a79f;margin-left:auto}footer{padding-top:20px;border-top:1px solid #e5e8df;font-size:11px;color:#8b948b;line-height:1.8}footer a{color:#627e70}@media(max-width:800px){main{padding:35px 20px}.grid{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}}@media(prefers-reduced-motion:reduce){.icon-card{transition:none}}
</style></head><body><main><header><div class="eyebrow">YIKE / CARD ICON LIBRARY</div><h1>给每一种记忆，一个符号。</h1><p>灵感、摘录、生活、工作、私密。统一的圆润轮廓，轻柔的双色材质。</p><div class="meta"><span>20 枚原创图标</span><span>SVG · 透明背景</span><span>64 × 64 统一画布</span></div></header>SECTIONS<footer>点击任意图标即可下载 SVG。下方展示 16 / 24 / 32 像素的实际尺寸。<br/><a href="./manifest.json">资源索引 manifest.json</a> · 私密图标用于表达内容含义，不代表记事已经加密。</footer></main></body></html>
'''
(DEST / "index.html").write_text(preview.replace("SECTIONS", "".join(sections)), encoding="utf-8")
(DEST / "README.md").write_text('''# 一刻卡片图标

20 枚原创 SVG，每类 4 枚；透明背景、64×64 画布、2.4px 圆头线条。
为小尺寸显示设计，以五套柔和双色区分含义。保持正方形比例；卡片主图标推荐 48–64px，辅助标记推荐 24–32px。

| 类别 | 图标 |
| --- | --- |
| 灵感 | 灵光一现、灵感火花、奇妙发现、想法萌芽 |
| 摘录 | 金句摘录、阅读笔记、收藏片段、重点标记 |
| 生活 | 日常小事、家的记忆、自然与健康、美好一天 |
| 工作 | 工作事项、待办清单、日程安排、目标计划 |
| 私密 | 私密记事、重要凭记、隐私保护、内心日记 |

预览：`/icons/cards/index.html`；索引：`manifest.json`。
代码中可从 `src/cardIcons.ts` 导入 `CARD_ICON_CATEGORIES`、`CARD_ICONS`、`getCardIcon`。

```tsx
import { getCardIcon } from "./cardIcons";
const icon = getCardIcon("inspiration-idea");
<img src={icon.src} alt={icon.name} width={48} height={48} />
```

重新生成：`python scripts/generate-card-icons.py`。
图标仅是素材资源，不自动给记事分配类别。私密图标不提供加密或访问控制。
''', encoding="utf-8")
print(f"Generated {sum(len(category['icons']) for category in manifest)} SVG icons, manifest, typed catalog and preview in {DEST}")
