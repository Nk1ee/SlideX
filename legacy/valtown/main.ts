import pptxgen from "npm:pptxgenjs@3.12.0";
import { Buffer } from "node:buffer";

// ============================================================================
// 1. КОНФИГУРАЦИЯ И ДИЗАЙН-ТОКЕНЫ
// ============================================================================
const CONFIG = {
  UNSPLASH_KEY: Deno.env.get("UNSPLASH_ACCESS_KEY") || "",
  GRID: {
    WIDTH: 10.0,
    HEIGHT: 5.625,
    MARGIN_LEFT: 0.8,
    MARGIN_RIGHT: 0.8,
    CONTENT_WIDTH: 8.4,
    HEADER_Y: 0.65,
    DIVIDER_Y: 1.25,
    CONTENT_START_Y: 1.50,
    SAFE_BOTTOM: 5.05,
    FOOTER_Y: 5.20,
  },
  FONTS: {
    TITLE: "Arial",
    BODY: "Arial",
  },
};

const THEMES: Record<string, any> = {
  deep_blue: {
    name: "Deep Blue",
    bg: "0A1128",
    cardBg: "121E3D",
    cardBorder: "1E3A8A",
    title: "FFFFFF",
    bodyBold: "FFFFFF",
    bodyRegular: "CBD5E1", // Четкий читаемый нежирный светлый текст
    accent: "38BDF8", // Неоново-голубой акцент
    subText: "7DD3FC",
    line: "1E293B",
    footer: "64748B",
  },
};

const STRICT_BLACKLIST =
  /(stalin|сталин|lenin|ленин|hitler|гитлер|putin|путин|navalny|навальный|president|президент|government|правительство|тюрьм|prison|arrest|арест|заключен|convict|gulag|гулаг|protest|rally|митинг|протест|плакат|политик|politics|demonstration|война|war|military|drawing|рисунок|sketch|набросок|engraving|гравюра|flag|флаг|coat_of_arms|герб|emblem|logo|formula|формула|equation|dictionary|словарь|book_cover)/i;

// ============================================================================
// 2. ДВИЖОК ТИПОГРАФИКИ: РАЗДЕЛЕНИЕ LEAD-IN И ПОДГОНКА ВЫСОТЫ
// ============================================================================
function parseLeadInText(rawText: string): { lead: string; body: string } {
  const parts = rawText.split(/\s+—\s+|\s+--\s+/);
  if (parts.length >= 2) {
    return {
      lead: parts[0].trim() + " — ",
      body: parts.slice(1).join(" — ").trim(),
    };
  }
  return { lead: "", body: rawText.trim() };
}

function fitText(
  text: string,
  widthInches: number,
  maxHeightInches: number,
  preferredFontSize: number,
  minFontSize: number = 11,
): { fontSize: number; estimatedHeight: number } {
  let fontSize = preferredFontSize;

  while (fontSize >= minFontSize) {
    const avgCharWidth = fontSize * 0.0070;
    const charsPerLine = Math.max(12, Math.floor(widthInches / avgCharWidth));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const lineHeightInches = (fontSize * 1.35) / 72;
    const estimatedHeight = lines * lineHeightInches;

    if (estimatedHeight <= maxHeightInches || fontSize === minFontSize) {
      return { fontSize, estimatedHeight };
    }
    fontSize -= 0.5;
  }

  return { fontSize: minFontSize, estimatedHeight: maxHeightInches };
}

function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

// ============================================================================
// 3. IMAGE ENGINE
// ============================================================================
async function fetchUniquePhoto(
  queryEn: string,
  topicRu: string,
  usedSignatures: Set<string>,
): Promise<string | null> {
  const cleanEn = (queryEn || "").replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const cleanRu = (topicRu || "").replace(/[^а-яА-ЯёЁa-zA-Z0-9\s]/g, " ")
    .trim();

  // 1. Unsplash (4K студийные фото)
  if (
    CONFIG.UNSPLASH_KEY && CONFIG.UNSPLASH_KEY.length > 5 && cleanEn.length > 3
  ) {
    try {
      const uUrl = `https://api.unsplash.com/search/photos?query=${
        encodeURIComponent(cleanEn)
      }&orientation=landscape&content_filter=high&per_page=15`;
      const res = await fetch(uUrl, {
        headers: { Authorization: `Client-ID ${CONFIG.UNSPLASH_KEY}` },
      });

      if (res.ok) {
        const data = await res.json();
        for (const item of data.results || []) {
          const desc = `${item.description || ""} ${
            item.alt_description || ""
          }`;
          if (STRICT_BLACKLIST.test(desc) || STRICT_BLACKLIST.test(item.id)) {
            continue;
          }

          const photoSig = hashString(item.id);
          if (usedSignatures.has(photoSig)) continue;

          const imgUrl = item.urls?.regular;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            if (imgRes.ok) {
              const buf = await imgRes.arrayBuffer();
              usedSignatures.add(photoSig);
              return `data:image/jpeg;base64,${
                Buffer.from(buf).toString("base64")
              }`;
            }
          }
        }
      }
    } catch (e) {}
  }

  // 2. Wikipedia (Резерв)
  if (cleanRu.length > 2) {
    try {
      const wikiUrl =
        `https://ru.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${
          encodeURIComponent(cleanRu)
        }&gsrlimit=8&prop=pageimages&pithumbsize=1200&format=json&origin=*`;
      const res = await fetch(wikiUrl, {
        headers: { "User-Agent": "SlidexV25/1.0" },
      });

      if (res.ok) {
        const data = await res.json();
        const pages = Object.values(data.query?.pages || {}) as any[];

        for (const p of pages) {
          const src = p.thumbnail?.source || "";
          const title = p.title || "";

          if (
            src && !STRICT_BLACKLIST.test(src) && !STRICT_BLACKLIST.test(title)
          ) {
            const photoSig = hashString(`wiki_${p.pageid || title}`);
            if (usedSignatures.has(photoSig)) continue;

            const imgRes = await fetch(src, {
              headers: { "User-Agent": "SlidexV25/1.0" },
            });
            if (imgRes.ok) {
              const buf = await imgRes.arrayBuffer();
              usedSignatures.add(photoSig);
              return `data:image/jpeg;base64,${
                Buffer.from(buf).toString("base64")
              }`;
            }
          }
        }
      }
    } catch (e) {}
  }

  return null;
}

// ============================================================================
// 4. БАЗОВЫЙ ШАБЛОН СЛАЙДА
// ============================================================================
function applyBaseSlide(slide: any, theme: any, meta: any, sData: any) {
  slide.background = { fill: theme.bg };

  // Пользовательские метаданные отображаются строго в авторском виде
  slide.addText(
    `${meta.studentName || "Студент"} | Группа ${meta.group || ""}`,
    {
      x: CONFIG.GRID.MARGIN_LEFT,
      y: CONFIG.GRID.FOOTER_Y,
      w: CONFIG.GRID.CONTENT_WIDTH,
      h: 0.3,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: 10,
      color: theme.footer,
      align: "right",
    },
  );

  if (sData.layout !== "title") {
    // Тег предмета
    slide.addText(`[ ${meta.subject?.toUpperCase() || "ДОКЛАД"} ]`, {
      x: CONFIG.GRID.MARGIN_LEFT,
      y: 0.4,
      w: CONFIG.GRID.CONTENT_WIDTH,
      h: 0.25,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: 10,
      bold: true,
      color: theme.accent,
    });

    // Заголовок
    const titleFit = fitText(
      sData.title || "Раздел",
      CONFIG.GRID.CONTENT_WIDTH,
      0.60,
      24,
      18,
    );
    slide.addText(sData.title || "Раздел", {
      x: CONFIG.GRID.MARGIN_LEFT,
      y: CONFIG.GRID.HEADER_Y,
      w: CONFIG.GRID.CONTENT_WIDTH,
      h: 0.60,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: titleFit.fontSize,
      bold: true,
      color: theme.title,
      valign: "top",
    });

    // Разделитель
    slide.addShape("rect", {
      x: CONFIG.GRID.MARGIN_LEFT,
      y: CONFIG.GRID.DIVIDER_Y,
      w: CONFIG.GRID.CONTENT_WIDTH,
      h: 0.02,
      fill: { color: theme.line },
    });
  }
}

// ============================================================================
// 5. МАКЕТЫ БЕЗ ЕДИНОЙ ПАРАЗИТНОЙ ФИГУРЫ
// ============================================================================

// 1. TITLE (Титульный лист)
function renderTitle(
  slide: any,
  theme: any,
  meta: any,
  sData: any,
  imgData: string | null,
) {
  slide.background = { fill: theme.bg };

  slide.addShape("rect", {
    x: 0.8,
    y: 1.3,
    w: 0.15,
    h: 2.7,
    fill: { color: theme.accent },
  });

  const titleW = imgData ? 4.5 : 8.0;
  const titleFit = fitText(
    meta.title || sData.title || "Презентация",
    titleW,
    1.8,
    30,
    22,
  );

  slide.addText(meta.title || sData.title || "Презентация", {
    x: 1.15,
    y: 1.25,
    w: titleW,
    h: 1.8,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: titleFit.fontSize,
    bold: true,
    color: theme.title,
    valign: "middle",
    wrap: true,
  });

  slide.addText(
    `Предмет: ${meta.subject || "Курс"}\nСтудент: ${
      meta.studentName || ""
    } (Группа ${meta.group || ""})`,
    {
      x: 1.15,
      y: 3.25,
      w: titleW,
      h: 0.85,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: 14,
      color: theme.subText,
      bold: true,
    },
  );

  if (imgData) {
    slide.addImage({
      data: imgData,
      x: 5.7,
      y: 1.25,
      w: 3.5,
      h: 3.0,
      sizing: { type: "cover", w: 3.5, h: 3.0 },
      rounding: true,
    });
  }
}

// 2. HERO (Фокусный тезис)
function renderHero(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const heroText = sData.bullets?.[0] || sData.title || "";
  const heroFit = fitText(heroText, 7.6, 1.5, 24, 18);

  slide.addShape("roundRect", {
    x: 0.8,
    y: 1.6,
    w: 8.4,
    h: 3.25,
    fill: { color: theme.cardBg },
    line: { color: theme.accent, width: 2 },
  });

  slide.addText("КЛЮЧЕВОЙ ТЕЗИС", {
    x: 1.2,
    y: 1.9,
    w: 7.6,
    h: 0.35,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: 13,
    bold: true,
    color: theme.accent,
  });

  slide.addText(heroText, {
    x: 1.2,
    y: 2.35,
    w: 7.6,
    h: 1.4,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: heroFit.fontSize,
    bold: true,
    color: theme.title,
    wrap: true,
  });

  const secondary = sData.bullets?.[1] || "";
  if (secondary) {
    slide.addText(secondary, {
      x: 1.2,
      y: 3.95,
      w: 7.6,
      h: 0.65,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: 15,
      color: theme.subText,
      wrap: true,
    });
  }
}

// 3. IMAGE_TEXT / FUTURE DIRECTIONS (Слева 3 направления с иерархией Lead-in, справа 4K фото)
function renderImageText(
  slide: any,
  theme: any,
  meta: any,
  sData: any,
  imgData: string | null,
) {
  applyBaseSlide(slide, theme, meta, sData);

  if (!imgData) {
    renderTwoColumn(slide, theme, meta, sData);
    return;
  }

  const isLeft = sData.visual?.placement === "left";
  const imgX = isLeft ? 0.8 : 5.3;
  const textX = isLeft ? 5.2 : 0.8;
  const colW = 4.0;

  const bullets = sData.bullets || [];
  const startY = bullets.length === 2 ? 1.85 : 1.55;
  const gap = bullets.length === 2 ? 1.4 : 1.15;

  bullets.slice(0, 3).forEach((b: string, i: number) => {
    const yPos = startY + i * gap;
    const { lead, body } = parseLeadInText(b);

    // Номер пункта
    slide.addText(`0${i + 1}`, {
      x: textX,
      y: yPos,
      w: 0.55,
      h: 0.4,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 18,
      bold: true,
      color: theme.accent,
      valign: "top",
    });

    // Иерархия: Термин жирным белым, пояснение — нежирным серым
    slide.addText(
      [
        {
          text: lead,
          options: { bold: true, color: theme.bodyBold, fontSize: 15.0 },
        },
        {
          text: body,
          options: { bold: false, color: theme.bodyRegular, fontSize: 14.0 },
        },
      ],
      {
        x: textX + 0.65,
        y: yPos,
        w: colW - 0.65,
        h: 0.95,
        fontFace: CONFIG.FONTS.BODY,
        valign: "top",
        wrap: true,
      },
    );
  });

  slide.addImage({
    data: imgData,
    x: imgX,
    y: CONFIG.GRID.CONTENT_START_Y,
    w: 3.9,
    h: 3.4,
    sizing: { type: "cover", w: 3.9, h: 3.4 },
    rounding: true,
  });
}

// 4. TWO_COLUMN / CONTENT
function renderTwoColumn(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const bullets = sData.bullets || [];

  if (bullets.length <= 1) {
    const text = bullets[0] || sData.title || "";
    const fit = fitText(text, 7.6, 1.8, 22, 16);

    slide.addShape("roundRect", {
      x: 0.8,
      y: 1.8,
      w: 8.4,
      h: 2.8,
      fill: { color: theme.cardBg },
      line: { color: theme.accent, width: 1.5 },
    });

    slide.addText("ОСНОВНОЙ АСПЕКТ", {
      x: 1.2,
      y: 2.1,
      w: 7.6,
      h: 0.35,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 13,
      bold: true,
      color: theme.accent,
    });

    slide.addText(text, {
      x: 1.2,
      y: 2.6,
      w: 7.6,
      h: 1.6,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: fit.fontSize,
      bold: true,
      color: theme.title,
      wrap: true,
    });
    return;
  }

  const startY = bullets.length === 2 ? 1.95 : 1.60;
  const gap = bullets.length === 2 ? 1.35 : 1.10;

  bullets.slice(0, 3).forEach((b: string, i: number) => {
    const yPos = startY + i * gap;
    const { lead, body } = parseLeadInText(b);

    slide.addText(`0${i + 1}`, {
      x: 0.8,
      y: yPos,
      w: 0.65,
      h: 0.4,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 20,
      bold: true,
      color: theme.accent,
      valign: "top",
    });

    slide.addText(
      [
        {
          text: lead,
          options: { bold: true, color: theme.bodyBold, fontSize: 16.5 },
        },
        {
          text: body,
          options: { bold: false, color: theme.bodyRegular, fontSize: 15.0 },
        },
      ],
      {
        x: 1.6,
        y: yPos,
        w: 7.5,
        h: 0.95,
        fontFace: CONFIG.FONTS.BODY,
        valign: "top",
        wrap: true,
      },
    );
  });
}

// 5. THREE_CARDS (Вызывается ТОЛЬКО когда реально нужны 3 карточки)
function renderThreeCards(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const cards = (sData.cards && sData.cards.length >= 3) ? sData.cards : [
    {
      title: "Вектор 1",
      description: sData.bullets?.[0] || "Аналитический аспект темы.",
    },
    {
      title: "Вектор 2",
      description: sData.bullets?.[1] || "Технологический аспект внедрения.",
    },
    {
      title: "Вектор 3",
      description: sData.bullets?.[2] || "Перспективы развития и выводы.",
    },
  ];

  const cardW = 2.60;
  const gap = 0.30;
  let startX = 0.8;

  cards.slice(0, 3).forEach((card: any, i: number) => {
    slide.addShape("roundRect", {
      x: startX,
      y: CONFIG.GRID.CONTENT_START_Y,
      w: cardW,
      h: 3.35,
      fill: { color: theme.cardBg },
      line: { color: theme.cardBorder, width: 1.5 },
    });

    slide.addText(`0${i + 1}`, {
      x: startX + 0.2,
      y: 1.75,
      w: 1.0,
      h: 0.35,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 18,
      bold: true,
      color: theme.accent,
    });

    slide.addText(card.title || `Вектор ${i + 1}`, {
      x: startX + 0.2,
      y: 2.15,
      w: cardW - 0.4,
      h: 0.6,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 15,
      bold: true,
      color: theme.title,
      wrap: true,
    });

    const cardDesc = card.description || card.text || sData.bullets?.[i] || "";
    const fit = fitText(cardDesc, cardW - 0.4, 1.8, 13.5, 11);
    slide.addText(cardDesc, {
      x: startX + 0.2,
      y: 2.85,
      w: cardW - 0.4,
      h: 1.8,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: fit.fontSize,
      color: theme.bodyRegular,
      wrap: true,
    });

    startX += cardW + gap;
  });
}

// 6. COMPARISON
function renderComparison(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const rawComp = sData.comparison || {};
  const leftPoints = (rawComp.leftItems && rawComp.leftItems.length > 0)
    ? rawComp.leftItems
    : [
      "Традиционный подход — классические лекционные методики",
      "Стандартная практика — ручная проверка заданий",
    ];
  const rightPoints = (rawComp.rightItems && rawComp.rightItems.length > 0)
    ? rawComp.rightItems
    : [
      "Цифровая среда — адаптивные алгоритмические платформы",
      "Автоматизация — персонализация образовательного процесса",
    ];

  const colW = 4.00;

  // Левая сторона
  slide.addShape("roundRect", {
    x: 0.8,
    y: CONFIG.GRID.CONTENT_START_Y,
    w: colW,
    h: 3.35,
    fill: { color: theme.cardBg },
    line: { color: theme.accent, width: 2 },
  });
  slide.addText(rawComp.leftTitle || "Традиционный подход", {
    x: 1.0,
    y: 1.75,
    w: colW - 0.4,
    h: 0.45,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: 17,
    bold: true,
    color: theme.accent,
  });
  const leftBody = leftPoints.map((t: string) => `• ${t}`).join("\n\n");
  slide.addText(leftBody, {
    x: 1.0,
    y: 2.30,
    w: colW - 0.4,
    h: 2.35,
    fontFace: CONFIG.FONTS.BODY,
    fontSize: 14.0,
    color: theme.bodyRegular,
    wrap: true,
  });

  // Правая сторона
  slide.addShape("roundRect", {
    x: 5.2,
    y: CONFIG.GRID.CONTENT_START_Y,
    w: colW,
    h: 3.35,
    fill: { color: theme.cardBg },
    line: { color: theme.cardBorder, width: 1.5 },
  });
  slide.addText(rawComp.rightTitle || "Цифровой подход", {
    x: 5.4,
    y: 1.75,
    w: colW - 0.4,
    h: 0.45,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: 17,
    bold: true,
    color: theme.title,
  });
  const rightBody = rightPoints.map((t: string) => `• ${t}`).join("\n\n");
  slide.addText(rightBody, {
    x: 5.4,
    y: 2.30,
    w: colW - 0.4,
    h: 2.35,
    fontFace: CONFIG.FONTS.BODY,
    fontSize: 14.0,
    color: theme.bodyRegular,
    wrap: true,
  });
}

// 7. TIMELINE
function renderTimeline(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const steps = sData.timeline || [
    {
      date: "2010-е",
      title: "Базовые системы",
      description: "Появление первых электронных образовательных сред.",
    },
    {
      date: "2020-е",
      title: "Адаптивность",
      description: "Внедрение систем предиктивного анализа успеваемости.",
    },
    {
      date: "Настоящее",
      title: "Нейросети",
      description: "Глубокая интеграция больших языковых моделей в обучение.",
    },
  ];

  const stepW = 2.60;
  let startX = 0.8;

  steps.slice(0, 3).forEach((st: any) => {
    slide.addShape("roundRect", {
      x: startX,
      y: CONFIG.GRID.CONTENT_START_Y,
      w: stepW,
      h: 3.35,
      fill: { color: theme.cardBg },
      line: { color: theme.cardBorder, width: 1.5 },
    });

    slide.addText(st.date || "Этап", {
      x: startX + 0.2,
      y: 1.75,
      w: stepW - 0.4,
      h: 0.4,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 16,
      bold: true,
      color: theme.accent,
    });

    slide.addText(st.title || "", {
      x: startX + 0.2,
      y: 2.25,
      w: stepW - 0.4,
      h: 0.6,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 15,
      bold: true,
      color: theme.title,
      wrap: true,
    });

    const fit = fitText(st.description || "", stepW - 0.4, 1.8, 13.5, 11);
    slide.addText(st.description || "", {
      x: startX + 0.2,
      y: 2.95,
      w: stepW - 0.4,
      h: 1.8,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: fit.fontSize,
      color: theme.bodyRegular,
      wrap: true,
    });

    startX += stepW + 0.30;
  });
}

// 8. STATISTICS
function renderStatistics(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const rawStat = sData.statistics || {};
  const statVal = String(rawStat.value || "78%").trim();
  const statLabel = rawStat.label || "Ключевой показатель";

  slide.addShape("roundRect", {
    x: 0.8,
    y: CONFIG.GRID.CONTENT_START_Y,
    w: 3.4,
    h: 3.35,
    fill: { color: theme.cardBg },
    line: { color: theme.accent, width: 2 },
  });

  const valFit = fitText(statVal, 3.2, 1.1, 46, 26);
  slide.addText(statVal, {
    x: 0.8,
    y: 1.9,
    w: 3.4,
    h: 1.1,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: valFit.fontSize,
    bold: true,
    color: theme.accent,
    align: "center",
  });

  slide.addText(statLabel, {
    x: 0.9,
    y: 3.2,
    w: 3.2,
    h: 0.9,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: 15,
    bold: true,
    color: theme.title,
    align: "center",
    wrap: true,
  });

  const bullets = sData.bullets || [
    "Эмпирические исследования — подтверждают ускорение усвоения ключевых тем",
    "Оптимизация времени — автоматизация снижает рутинную нагрузку преподавателя",
  ];
  let currentY = CONFIG.GRID.CONTENT_START_Y + 0.2;

  bullets.slice(0, 2).forEach((b: string, i: number) => {
    const { lead, body } = parseLeadInText(b);

    slide.addText(`0${i + 1}`, {
      x: 4.6,
      y: currentY,
      w: 0.5,
      h: 0.4,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 19,
      bold: true,
      color: theme.accent,
    });

    slide.addText(
      [
        {
          text: lead,
          options: { bold: true, color: theme.bodyBold, fontSize: 15.5 },
        },
        {
          text: body,
          options: { bold: false, color: theme.bodyRegular, fontSize: 14.5 },
        },
      ],
      {
        x: 5.2,
        y: currentY,
        w: 4.0,
        h: 1.0,
        fontFace: CONFIG.FONTS.BODY,
        valign: "top",
        wrap: true,
      },
    );

    currentY += 1.35;
  });
}

// 9. SOURCES (ЧИСТЕЙШИЙ СПИСОК ВО ВСЮ ШИРИНУ ЭКРАНА: НИ ЕДИНОЙ РАМКИ!)
function renderSources(slide: any, theme: any, meta: any, sData: any) {
  applyBaseSlide(slide, theme, meta, sData);

  const sources = (sData.sources && sData.sources.length > 0)
    ? sData.sources
    : [
      "UNESCO. AI and Education: Guidance for Policy-Makers. — Paris: UNESCO Publishing, 2021.",
      "Иванов А. В. Цифровые технологии в высшей школе. — М.: Наука, 2024.",
      "Петрова С. Н. Адаптивные алгоритмические платформы в педагогике. — СПб.: Питер, 2023.",
    ];
  let currentY = 1.75;

  sources.slice(0, 4).forEach((src: string, i: number) => {
    // Номер источника
    slide.addText(`[0${i + 1}]`, {
      x: 0.8,
      y: currentY,
      w: 0.8,
      h: 0.45,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 14,
      bold: true,
      color: theme.accent,
    });

    // Полный текст источника (ширина 7.5 дюймов — ничего не режется!)
    slide.addText(src, {
      x: 1.65,
      y: currentY,
      w: 7.55,
      h: 0.55,
      fontFace: CONFIG.FONTS.BODY,
      fontSize: 14.0,
      color: theme.bodyRegular,
      wrap: true,
    });

    currentY += 0.75;
  });
}

// 10. CONCLUSION (СТРОГО 3 ЧИСТЫХ ВЫВОДА: НИКАКИХ ПЛАШЕК ПО ЦЕНТРУ!)
function renderConclusion(slide: any, theme: any, meta: any, sData: any) {
  slide.background = { fill: theme.bg };

  slide.addText(`[ РЕЗЮМЕ ]`, {
    x: CONFIG.GRID.MARGIN_LEFT,
    y: 0.4,
    w: CONFIG.GRID.CONTENT_WIDTH,
    h: 0.25,
    fontFace: CONFIG.FONTS.BODY,
    fontSize: 11,
    bold: true,
    color: theme.accent,
  });

  slide.addText(sData.title || "Заключение и ключевые выводы", {
    x: CONFIG.GRID.MARGIN_LEFT,
    y: CONFIG.GRID.HEADER_Y,
    w: CONFIG.GRID.CONTENT_WIDTH,
    h: 0.65,
    fontFace: CONFIG.FONTS.TITLE,
    fontSize: 26,
    bold: true,
    color: theme.title,
    valign: "top",
  });

  slide.addShape("rect", {
    x: CONFIG.GRID.MARGIN_LEFT,
    y: CONFIG.GRID.DIVIDER_Y,
    w: CONFIG.GRID.CONTENT_WIDTH,
    h: 0.03,
    fill: { color: theme.accent },
  });

  const bullets = sData.bullets || [
    "Инновационный прорыв — искусственный интеллект становится базовым инструментом образования.",
    "Баланс и этика — развитие ИИ требует строгого контроля академической честности.",
    "Человеческий фактор — технологии усиливают роль преподавателя, но не заменяют наставника.",
  ];
  let currentY = 1.65;

  bullets.slice(0, 3).forEach((b: string, i: number) => {
    const { lead, body } = parseLeadInText(b);

    slide.addText(`0${i + 1}`, {
      x: 0.8,
      y: currentY,
      w: 0.7,
      h: 0.4,
      fontFace: CONFIG.FONTS.TITLE,
      fontSize: 24,
      bold: true,
      color: theme.accent,
      valign: "top",
    });

    slide.addText(
      [
        {
          text: lead,
          options: { bold: true, color: theme.bodyBold, fontSize: 17.5 },
        },
        {
          text: body,
          options: { bold: false, color: theme.bodyRegular, fontSize: 15.5 },
        },
      ],
      {
        x: 1.6,
        y: currentY,
        w: 7.6,
        h: 0.95,
        fontFace: CONFIG.FONTS.BODY,
        valign: "top",
        wrap: true,
      },
    );

    currentY += 1.10;
  });
}

// ============================================================================
// 6. ГЛАВНЫЙ ОБРАБОТЧИК С ЖЕСТКИМ ПРИОРИТЕТОМ ФИНАЛА
// ============================================================================
export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Send POST with presentation JSON", { status: 400 });
  }

  try {
    const inputData = await req.json();
    const meta = inputData.presentation || {};
    const slides = inputData.slides || [];

    if (!Array.isArray(slides) || slides.length === 0) {
      return new Response(JSON.stringify({ error: "Массив слайдов пуст" }), {
        status: 400,
      });
    }

    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9";

    const styleKey = meta.style || "deep_blue";
    const theme = THEMES[styleKey] || THEMES.deep_blue;

    const usedSignatures = new Set<string>();
    const imageMap = new Map<number, string>();

    // Ищем фото строго для слайдов, не являющихся финалом
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const titleLower = (s.title || "").toLowerCase();
      const isConclusionOrSources = i === slides.length - 1 ||
        /заключение|вывод|итог|источник|литератур|библиограф|sources/i.test(
          titleLower,
        );

      if (s.visual?.needed && !isConclusionOrSources) {
        const queryEn = s.visual?.query_en || "";
        const b64 = await fetchUniquePhoto(
          queryEn,
          meta.topic || s.title,
          usedSignatures,
        );
        if (b64) imageMap.set(i, b64);
      }
    }

    // РЕНДЕРИНГ СЛАЙДОВ С ЖЕСТКИМ ПРИОРИТЕТОМ
    slides.forEach((sData: any, idx: number) => {
      const slide = pres.addSlide();
      const imgData = imageMap.get(idx) || null;
      const titleLower = (sData.title || "").toLowerCase();
      const isLast = idx === slides.length - 1;

      // 1. ТИТУЛ
      if (idx === 0 || sData.layout === "title") {
        renderTitle(slide, theme, meta, sData, imgData);
      } // 2. ЗАКЛЮЧЕНИЕ (ЖЕСТКИЙ ПЕРЕХВАТ — НИКАКИХ КАРТОЧЕК THREE_CARDS!)
      else if (
        isLast || /заключение|вывод|итог/i.test(titleLower) ||
        sData.layout === "conclusion"
      ) {
        renderConclusion(slide, theme, meta, sData);
      } // 3. ИСТОЧНИКИ (ЖЕСТКИЙ ПЕРЕХВАТ — ТОЛЬКО ЧИСТЫЙ СПИСОК!)
      else if (
        /источник|литератур|библиограф|sources/i.test(titleLower) ||
        sData.layout === "sources"
      ) {
        renderSources(slide, theme, meta, sData);
      } // 4. СЛАЙД С ФОТОГРАФИЕЙ
      else if (
        imgData && sData.layout !== "comparison" && sData.layout !== "timeline"
      ) {
        renderImageText(slide, theme, meta, sData, imgData);
      } // 5. ОСТАЛЬНЫЕ МАКЕТЫ
      else if (sData.layout === "hero") {
        renderHero(slide, theme, meta, sData);
      } else if (sData.layout === "comparison") {
        renderComparison(slide, theme, meta, sData);
      } else if (sData.layout === "timeline") {
        renderTimeline(slide, theme, meta, sData);
      } else if (sData.layout === "statistics") {
        renderStatistics(slide, theme, meta, sData);
      } else if (sData.layout === "three_cards") {
        renderThreeCards(slide, theme, meta, sData);
      } else {
        renderTwoColumn(slide, theme, meta, sData);
      }
    });

    const buffer = await pres.write({ outputType: "arraybuffer" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition":
          'attachment; filename="slidex_presentation.pptx"',
      },
    });
  } catch (err: any) {
    console.error("[Slidex Fatal Error]:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}