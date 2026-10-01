# 一刻卡片图标

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
