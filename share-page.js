import { SHARE_COPY } from './share-copy.generated.js';

const APP_STORE_URL = 'https://apps.apple.com/de/app/postervia/id6768678629?l=en-GB';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.novaku.mobile';

const BASE_COPY = {
  en: {
    openInApp: 'Open in App',
    seeRest: 'See the rest in Postervia',
    readFull: 'Read the full post',
    showLess: 'Show less',
    comments: 'Comments',
    viewAllComments: 'View all {count} comments in the app',
    showReplies: 'Show all {count} replies in the app',
    helpful: 'Helpful',
    saves: 'Saves',
    mediaAlt: 'Image {current} of {total} from {author}',
    appStore: 'Download on the App Store',
    playStore: 'Get it on Google Play',
    unavailableTitle: 'Continue in Postervia',
    unavailableBody: 'This shared post is unavailable on the web. Open Postervia to keep exploring.',
  },
  de: {
    openInApp: 'In der App öffnen',
    seeRest: 'Den Rest in Postervia ansehen',
    readFull: 'Ganzen Beitrag lesen',
    showLess: 'Weniger anzeigen',
    comments: 'Kommentare',
    viewAllComments: 'Alle {count} Kommentare in der App ansehen',
    showReplies: 'Alle {count} Antworten in der App ansehen',
    helpful: 'Hilfreich',
    saves: 'Gespeichert',
    mediaAlt: 'Bild {current} von {total} von {author}',
    appStore: 'Im App Store laden',
    playStore: 'Bei Google Play laden',
    unavailableTitle: 'In Postervia fortfahren',
    unavailableBody: 'Dieser geteilte Beitrag ist im Web nicht verfügbar. Öffne Postervia, um weiterzusuchen.',
  },
  'zh-CN': {
    openInApp: '在 App 中打开',
    seeRest: '打开 Postervia 查看更多',
    readFull: '展开全文',
    showLess: '收起',
    comments: '评论',
    viewAllComments: '在 App 中查看全部 {count} 条评论',
    showReplies: '在 App 中查看全部 {count} 条回复',
    helpful: '有帮助',
    saves: '收藏',
    mediaAlt: '{author} 的第 {current} 张图片，共 {total} 张',
    appStore: '前往 App Store 下载',
    playStore: '前往 Google Play 下载',
    unavailableTitle: '在 Postervia 中继续',
    unavailableBody: '这篇分享贴文暂时无法在网页中查看。打开 Postervia 继续探索。',
  },
  'zh-TW': {
    openInApp: '在 App 中開啟',
    seeRest: '開啟 Postervia 查看更多',
    readFull: '展開全文',
    showLess: '收合',
    comments: '留言',
    viewAllComments: '在 App 中查看全部 {count} 則留言',
    showReplies: '在 App 中查看全部 {count} 則回覆',
    helpful: '有幫助',
    saves: '收藏',
    mediaAlt: '{author} 的第 {current} 張圖片，共 {total} 張',
    appStore: '前往 App Store 下載',
    playStore: '前往 Google Play 下載',
    unavailableTitle: '在 Postervia 中繼續',
    unavailableBody: '這篇分享貼文暫時無法在網頁中查看。開啟 Postervia 繼續探索。',
  },
  ar: {
    openInApp: 'فتح في التطبيق',
    seeRest: 'شاهد الباقي في Postervia',
    readFull: 'قراءة المنشور كاملاً',
    showLess: 'عرض أقل',
    comments: 'التعليقات',
    viewAllComments: 'عرض كل التعليقات ({count}) في التطبيق',
    showReplies: 'عرض كل الردود ({count}) في التطبيق',
    helpful: 'مفيد',
    saves: 'المحفوظات',
    mediaAlt: 'الصورة {current} من {total} بواسطة {author}',
    appStore: 'تنزيل من App Store',
    playStore: 'تنزيل من Google Play',
    unavailableTitle: 'المتابعة في Postervia',
    unavailableBody: 'هذا المنشور المشترك غير متاح على الويب. افتح Postervia لمتابعة الاستكشاف.',
  },
};

const COPY = { ...SHARE_COPY };
for (const [locale, copy] of Object.entries(BASE_COPY)) {
  COPY[locale] = { ...copy, ...COPY[locale] };
}

const RTL_LANGUAGES = new Set(['ar', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeLocale(raw) {
  const candidate = String(raw || '').trim().replace('_', '-');
  if (!candidate) return null;
  const lower = candidate.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans') return 'zh-CN';
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-hant') return 'zh-TW';
  const base = lower.split('-')[0];
  if (COPY[candidate]) return candidate;
  if (COPY[base]) return base;
  return null;
}

export function resolveShareLocale(acceptLanguage, requestedLocale) {
  const requested = normalizeLocale(requestedLocale);
  if (requested) return requested;
  for (const part of String(acceptLanguage || '').split(',')) {
    const locale = normalizeLocale(part.split(';')[0]);
    if (locale) return locale;
  }
  return 'en';
}

function languageDirection(locale) {
  return RTL_LANGUAGES.has(locale.split('-')[0]) ? 'rtl' : 'ltr';
}

function copyFor(locale) {
  return COPY[locale] || COPY[locale.split('-')[0]] || COPY.en;
}

function formatCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function integer(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function formattedNumber(value, locale) {
  return new Intl.NumberFormat(locale).format(integer(value));
}

function formattedDate(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function escapedMultiline(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function avatarMarkup(name, avatarUrl, className = 'avatar') {
  const safeAvatar = safeHttpsUrl(avatarUrl);
  const initial = Array.from(String(name || 'P').trim())[0] || 'P';
  if (safeAvatar) {
    return `<img class="${className}" src="${escapeHtml(safeAvatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return `<span class="${className} avatar-fallback" aria-hidden="true">${escapeHtml(initial.toUpperCase())}</span>`;
}

function watermarkMarkup() {
  return `<span class="watermark" data-watermark aria-hidden="true"><img src="/assets/postervia-icon.png" alt="">Postervia</span>`;
}

function mediaMarkup(preview, copy) {
  const total = integer(preview.total_media_count);
  const media = Array.isArray(preview.media_items)
    ? preview.media_items
      .map((item) => ({ url: safeHttpsUrl(item && item.url), mimeType: item && item.mime_type }))
      .filter((item) => item.url && (!item.mimeType || String(item.mimeType).startsWith('image/')))
      .slice(0, 4)
    : [];
  if (!media.length) return '';

  const displayTotal = Math.max(total, media.length);
  const slides = media.map((item, index) => {
    const locked = index === 3 && displayTotal > 3;
    const state = locked ? 'locked' : 'visible';
    const alt = formatCopy(copy.mediaAlt, {
      current: index + 1,
      total: displayTotal,
      author: preview.author_name || 'Postervia',
    });
    return `<figure class="media-slide${locked ? ' is-locked' : ''}" data-media-state="${state}">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(alt)}" ${index === 0 ? 'fetchpriority="high"' : locked ? 'loading="eager"' : 'loading="lazy"'} referrerpolicy="no-referrer">
      ${watermarkMarkup()}
      ${locked ? `<a class="locked-media-link js-app-link" href="__APP_LINK__"__STORE_DATA__><span class="locked-count">4 / ${displayTotal}</span><strong>${escapeHtml(copy.seeRest)}</strong></a>` : ''}
    </figure>`;
  }).join('');
  const dots = media.map((_, index) => {
    const label = formatCopy(copy.mediaAlt, {
      current: index + 1,
      total: displayTotal,
      author: preview.author_name || 'Postervia',
    });
    return `<button type="button" class="media-dot${index === 0 ? ' is-active' : ''}" data-slide-dot="${index}" aria-label="${escapeHtml(label)}"></button>`;
  }).join('');
  return `<section class="media-shell" aria-label="${escapeHtml(copy.mediaLabel)}">
    <div class="media-counter" aria-live="polite"><span data-current-media>1</span> / ${displayTotal}</div>
    <div class="media-track" data-media-track tabindex="0">${slides}</div>
    ${media.length > 1 ? `<div class="media-dots">${dots}</div>` : ''}
  </section>`;
}

function commentsMarkup(preview, copy, locale) {
  const comments = Array.isArray(preview.comments_preview)
    ? preview.comments_preview
      .filter((comment) => comment && comment.moderation_status === 'approved')
      .slice(0, 3)
    : [];
  const total = integer(preview.comment_count);
  if (!comments.length && !total) return '';

  const rows = comments.map((comment) => {
    const replyCount = integer(comment.reply_count);
    const helpfulCount = integer(comment.helpful_count);
    return `<article class="comment-row">
      ${avatarMarkup(comment.author_name, comment.author_avatar_url, 'comment-avatar')}
      <div class="comment-copy">
        <div class="comment-heading"><strong>${escapeHtml(comment.author_name || 'Postervia')}</strong><time>${escapeHtml(formattedDate(comment.created_at, locale))}</time></div>
        <p>${escapedMultiline(comment.body)}</p>
        <div class="comment-meta">
          ${helpfulCount ? `<span>${escapeHtml(copy.helpful)} · ${formattedNumber(helpfulCount, locale)}</span>` : ''}
          ${replyCount ? `<a class="js-app-link reply-link" href="__APP_LINK__"__STORE_DATA__>${escapeHtml(formatCopy(copy.showReplies, { count: formattedNumber(replyCount, locale) }))}</a>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
  const hiddenComments = total > comments.length;
  return `<section class="comments-section" aria-labelledby="comments-title">
    <h2 id="comments-title">${escapeHtml(copy.comments)}${total ? ` <span>${formattedNumber(total, locale)}</span>` : ''}</h2>
    ${rows}
    ${hiddenComments ? `<a class="view-comments js-app-link" href="__APP_LINK__"__STORE_DATA__>${escapeHtml(formatCopy(copy.viewAllComments, { count: formattedNumber(total, locale) }))}</a>` : ''}
  </section>`;
}

function appLink(postId, token) {
  return `postervia://p/${postId}?s=${token}`;
}

function pageScript() {
  return `<script>
(() => {
  const track = document.querySelector('[data-media-track]');
  if (track) {
    const slides = Array.from(track.querySelectorAll('.media-slide'));
    const counter = document.querySelector('[data-current-media]');
    const dots = Array.from(document.querySelectorAll('[data-slide-dot]'));
    const update = () => {
      if (!slides.length) return;
      const index = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))));
      if (counter) counter.textContent = String(index + 1);
      dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
    };
    track.addEventListener('scroll', update, { passive: true });
    dots.forEach((dot, index) => dot.addEventListener('click', () => track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })));
  }

  const body = document.querySelector('[data-post-body]');
  const bodyToggle = document.querySelector('[data-body-toggle]');
  if (body && bodyToggle) {
    bodyToggle.addEventListener('click', () => {
      const expanded = body.classList.toggle('is-expanded');
      bodyToggle.textContent = expanded ? bodyToggle.dataset.less : bodyToggle.dataset.more;
      bodyToggle.setAttribute('aria-expanded', String(expanded));
    });
  }

  document.querySelectorAll('.js-app-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      const fallback = link.dataset.storeUrl;
      if (!fallback) return;
      event.preventDefault();
      const started = Date.now();
      window.location.href = link.href;
      window.setTimeout(() => {
        if (!document.hidden && Date.now() - started < 1800) window.location.href = fallback;
      }, 900);
    });
  });
})();
</script>`;
}

const PAGE_CSS = `<style>
:root{--coral:#F67673;--coral-dark:#C94F55;--cream:#FFF8F1;--ink:#242427;--muted:#737277;--line:#EBE5DF;--paper:#FFFFFF;--shadow:0 18px 50px rgba(71,45,37,.12)}
*{box-sizing:border-box}
html{background:#F1ECE6;color:var(--ink);font-family:"Plus Jakarta Sans","Avenir Next","Noto Sans",sans-serif;scroll-behavior:smooth}
body{margin:0;min-height:100vh;padding-bottom:112px;background:#F1ECE6}
button,a{font:inherit}
a{color:inherit}a:focus-visible,button:focus-visible{outline:3px solid #31527B;outline-offset:3px}
.page{width:min(100%,640px);min-height:100vh;margin:0 auto;background:var(--paper);box-shadow:var(--shadow)}
.brand-header{position:sticky;top:0;z-index:20;height:64px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.94);border-bottom:1px solid rgba(235,229,223,.9);backdrop-filter:blur(18px)}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-size:18px;font-weight:800;letter-spacing:-.02em}.brand img{width:36px;height:36px;border-radius:11px}.brand small{display:block;color:var(--muted);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.header-open{min-height:44px;padding:9px 15px;border:1px solid var(--coral);border-radius:999px;color:var(--coral-dark);font-size:13px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center}
.media-shell{position:relative;background:#19191B;overflow:hidden}.media-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}.media-track::-webkit-scrollbar{display:none}.media-slide{position:relative;flex:0 0 100%;height:min(78vh,720px);min-height:420px;margin:0;scroll-snap-align:start;background:#161618}.media-slide>img{width:100%;height:100%;display:block;object-fit:cover}.watermark{position:absolute;right:18px;bottom:22px;z-index:2;display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:rgba(20,20,22,.46);color:rgba(255,255,255,.9);font-size:12px;font-weight:800;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:none}.watermark img{width:18px;height:18px;border-radius:6px}.media-counter{position:absolute;top:16px;right:16px;z-index:4;padding:6px 10px;border-radius:999px;background:rgba(22,22,24,.58);color:#fff;font-size:12px;font-weight:800;backdrop-filter:blur(8px)}.media-dots{position:absolute;left:50%;bottom:10px;z-index:4;display:flex;gap:0;transform:translateX(-50%)}.media-dot{position:relative;width:24px;height:24px;padding:0;border:0;background:transparent}.media-dot:after{content:"";position:absolute;top:50%;left:50%;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.55);transform:translate(-50%,-50%)}.media-dot.is-active:after{width:18px;border-radius:8px;background:var(--coral)}
.media-slide.is-locked>img{filter:brightness(.45) blur(1.5px);transform:scale(1.015)}.media-slide.is-locked:after{content:"";position:absolute;inset:0;background:rgba(16,14,15,.24)}.locked-media-link{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#fff;text-decoration:none;text-align:center}.locked-media-link strong{padding:13px 20px;border:1px solid rgba(255,255,255,.65);border-radius:999px;background:rgba(30,27,28,.44);font-size:16px;backdrop-filter:blur(10px)}.locked-count{position:absolute;top:16px;right:16px;padding:6px 10px;border-radius:999px;background:rgba(22,22,24,.58);font-size:12px;font-weight:800}
.post-main{padding:24px 24px 0}.author-row{display:flex;align-items:center;gap:12px}.avatar,.avatar-fallback{width:48px;height:48px;flex:0 0 48px;border-radius:50%;object-fit:cover}.avatar-fallback{display:grid;place-items:center;background:#FFE2D8;color:var(--coral-dark);font-weight:800}.author-copy{min-width:0;flex:1}.author-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.author-copy span{display:block;margin-top:3px;color:var(--muted);font-size:12px}.post-main h1{margin:24px 0 12px;font-size:clamp(24px,5vw,34px);line-height:1.16;letter-spacing:-.04em}.post-body{position:relative;max-height:7.2em;overflow:hidden;color:#3D3B3C;font-size:16px;line-height:1.72}.post-body:after{content:"";position:absolute;right:0;bottom:0;left:0;height:38px;background:linear-gradient(transparent,#fff)}.post-body.is-expanded{max-height:none}.post-body.is-expanded:after{display:none}.body-toggle{margin:8px 0 0;padding:4px 0;border:0;background:none;color:#31527B;font-weight:800;cursor:pointer}.stats{display:flex;gap:24px;margin:24px 0 0;padding:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);color:#4C494A}.stat{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}.stat svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8}
.comments-section{padding:28px 24px 30px}.comments-section h2{margin:0 0 6px;font-size:20px;letter-spacing:-.02em}.comments-section h2 span{color:var(--muted);font-size:14px;font-weight:600}.comment-row{display:grid;grid-template-columns:42px minmax(0,1fr);gap:12px;padding:20px 0;border-bottom:1px solid var(--line)}.comment-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover}.comment-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.comment-heading strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.comment-heading time{flex:none;color:#969195;font-size:11px}.comment-copy p{margin:7px 0;color:#383536;font-size:15px;line-height:1.55}.comment-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:12px}.reply-link{color:#31527B;font-weight:800;text-decoration:none}.view-comments{display:block;margin:24px 0 0;padding:13px 18px;border:1px solid var(--coral);border-radius:999px;color:var(--coral-dark);font-size:14px;font-weight:800;text-align:center;text-decoration:none}
.app-dock{position:fixed;right:0;bottom:max(14px,env(safe-area-inset-bottom));left:0;z-index:30;display:flex;justify-content:center;pointer-events:none}.app-dock a{width:min(420px,calc(100% - 32px));display:flex;align-items:center;justify-content:center;gap:10px;padding:15px 20px;border-radius:999px;background:var(--coral);box-shadow:0 12px 32px rgba(185,73,79,.34);color:#fff;font-size:16px;font-weight:800;text-decoration:none;pointer-events:auto}.app-dock img{width:27px;height:27px;border-radius:8px}
.generic{min-height:100vh;display:grid;place-items:center;padding:36px 22px;background:var(--cream);text-align:center}.generic-card{width:min(100%,430px);padding:36px 26px;background:#fff;border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow)}.generic-card>img{width:82px;height:82px;border-radius:24px}.generic-card h1{margin:20px 0 10px;font-size:28px}.generic-card p{margin:0 auto 24px;max-width:330px;color:var(--muted);line-height:1.6}.store-links{display:grid;gap:10px}.store-links a{padding:13px 16px;border:1px solid var(--line);border-radius:14px;font-weight:800;text-decoration:none}.store-links a:first-child{background:var(--ink);color:#fff}
@media (max-width:640px){html,body{background:#fff}.page{box-shadow:none}.brand-header{height:58px;padding:0 16px}.brand{font-size:17px}.brand img{width:32px;height:32px}.brand small{display:none}.header-open{padding:8px 12px;font-size:12px}.media-slide{height:auto;min-height:0;aspect-ratio:4/5}.post-main,.comments-section{padding-right:18px;padding-left:18px}.post-main h1{margin-top:20px}.comment-heading{align-items:flex-start;flex-direction:column;gap:3px}.app-dock{bottom:max(10px,env(safe-area-inset-bottom))}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.media-track{scroll-behavior:auto}}
</style>`;

export function postPageHtml({ preview, pageUrl, postId, token, locale, storeUrl, ogBlock }) {
  const copy = copyFor(locale);
  const direction = languageDirection(locale);
  const deepLink = appLink(postId, token);
  const fallbackData = storeUrl ? ` data-store-url="${escapeHtml(storeUrl)}"` : '';
  const title = `${escapeHtml(preview.title)} · Postervia`;
  const metaLine = [preview.city, formattedDate(preview.created_at, locale)].filter(Boolean).map(escapeHtml).join(' · ');
  const shouldCollapseBody = String(preview.body || '').length > 280;
  const media = mediaMarkup(preview, copy)
    .replaceAll('__APP_LINK__', escapeHtml(deepLink))
    .replaceAll('__STORE_DATA__', fallbackData);
  const comments = commentsMarkup(preview, copy, locale)
    .replaceAll('__APP_LINK__', escapeHtml(deepLink))
    .replaceAll('__STORE_DATA__', fallbackData);
  return `<!doctype html>
<html lang="${escapeHtml(locale)}" dir="${direction}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#FFFFFF">
<title>${title}</title>
${ogBlock(preview, pageUrl)}
${PAGE_CSS}
</head><body>
<main class="page">
  <header class="brand-header">
    <a class="brand" href="/" aria-label="Postervia"><img src="/assets/postervia-icon.png" alt=""><span>Postervia<small>${escapeHtml(copy.brandTagline)}</small></span></a>
    <a class="header-open js-app-link" href="${escapeHtml(deepLink)}"${fallbackData}>${escapeHtml(copy.openInApp)}</a>
  </header>
  ${media}
  <article class="post-main">
    <div class="author-row">${avatarMarkup(preview.author_name, preview.author_avatar_url)}<div class="author-copy"><strong>${escapeHtml(preview.author_name || 'Postervia')}</strong>${metaLine ? `<span>${metaLine}</span>` : ''}</div></div>
    <h1>${escapeHtml(preview.title)}</h1>
    <div id="post-body" class="post-body${shouldCollapseBody ? '' : ' is-expanded'}" data-post-body>${escapedMultiline(preview.body || preview.description || '')}</div>
    ${shouldCollapseBody ? `<button class="body-toggle" type="button" data-body-toggle data-more="${escapeHtml(copy.readFull)}" data-less="${escapeHtml(copy.showLess)}" aria-controls="post-body" aria-expanded="false">${escapeHtml(copy.readFull)}</button>` : ''}
    <div class="stats" aria-label="${escapeHtml(copy.postStatistics)}">
      <span class="stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>${formattedNumber(preview.helpful_count, locale)} ${escapeHtml(copy.helpful)}</span>
      <span class="stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>${formattedNumber(preview.save_count, locale)} ${escapeHtml(copy.saves)}</span>
    </div>
  </article>
  ${comments}
</main>
<div class="app-dock"><a class="js-app-link" href="${escapeHtml(deepLink)}"${fallbackData}><img src="/assets/postervia-icon.png" alt="">${escapeHtml(copy.openInApp)}</a></div>
${pageScript()}
</body></html>`;
}

export function genericPostLandingHtml({ locale }) {
  const copy = copyFor(locale);
  const direction = languageDirection(locale);
  return `<!doctype html>
<html lang="${escapeHtml(locale)}" dir="${direction}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#FFF8F1"><title>Postervia</title>${PAGE_CSS}
</head><body><main class="generic"><section class="generic-card"><img src="/assets/postervia-icon.png" alt="Postervia"><h1>${escapeHtml(copy.unavailableTitle)}</h1><p>${escapeHtml(copy.unavailableBody)}</p><div class="store-links"><a href="${APP_STORE_URL}">${escapeHtml(copy.appStore)}</a><a href="${PLAY_STORE_URL}">${escapeHtml(copy.playStore)}</a></div></section></main></body></html>`;
}

export { APP_STORE_URL, PLAY_STORE_URL };
