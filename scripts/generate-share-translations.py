"""Generate the web-share chrome translations used by the Cloudflare Worker."""

from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openai import OpenAI
from pydantic import ConfigDict, conlist, create_model

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
SITE_I18N_PATH = ROOT / "public" / "assets" / "site-i18n.js"
OUTPUT_PATH = ROOT / "share-copy.generated.js"
ENV_PATH = PROJECT_ROOT / "novaku-backend" / ".env"

ENGLISH = {
    "openInApp": "Open in App",
    "seeRest": "See the rest in Postervia",
    "readFull": "Read the full post",
    "showLess": "Show less",
    "comments": "Comments",
    "viewAllComments": "View all {count} comments in the app",
    "showReplies": "Show all {count} replies in the app",
    "helpful": "Helpful",
    "saves": "Saves",
    "mediaAlt": "Image {current} of {total} from {author}",
    "appStore": "Download on the App Store",
    "playStore": "Get it on Google Play",
    "unavailableTitle": "Continue in Postervia",
    "unavailableBody": (
        "This shared post is unavailable on the web. "
        "Open Postervia to keep exploring."
    ),
    "brandTagline": "Local paths, shared",
    "mediaLabel": "Post images",
    "postStatistics": "Post statistics",
}

MANUAL = {
    "en": ENGLISH,
    "de": {
        "openInApp": "In der App öffnen",
        "seeRest": "Den Rest in Postervia ansehen",
        "readFull": "Ganzen Beitrag lesen",
        "showLess": "Weniger anzeigen",
        "comments": "Kommentare",
        "viewAllComments": "Alle {count} Kommentare in der App ansehen",
        "showReplies": "Alle {count} Antworten in der App ansehen",
        "helpful": "Hilfreich",
        "saves": "Gespeichert",
        "mediaAlt": "Bild {current} von {total} von {author}",
        "appStore": "Im App Store laden",
        "playStore": "Bei Google Play laden",
        "unavailableTitle": "In Postervia fortfahren",
        "unavailableBody": (
            "Dieser geteilte Beitrag ist im Web nicht verfügbar. "
            "Öffne Postervia, um weiterzusuchen."
        ),
        "brandTagline": "Lokale Wege, gemeinsam geteilt",
        "mediaLabel": "Bilder des Beitrags",
        "postStatistics": "Beitragsstatistik",
    },
    "zh-CN": {
        "openInApp": "在 App 中打开",
        "seeRest": "打开 Postervia 查看更多",
        "readFull": "展开全文",
        "showLess": "收起",
        "comments": "评论",
        "viewAllComments": "在 App 中查看全部 {count} 条评论",
        "showReplies": "在 App 中查看全部 {count} 条回复",
        "helpful": "有帮助",
        "saves": "收藏",
        "mediaAlt": "{author} 的第 {current} 张图片，共 {total} 张",
        "appStore": "前往 App Store 下载",
        "playStore": "前往 Google Play 下载",
        "unavailableTitle": "在 Postervia 中继续",
        "unavailableBody": "这篇分享贴文暂时无法在网页中查看。打开 Postervia 继续探索。",
        "brandTagline": "分享本地路径",
        "mediaLabel": "贴文图片",
        "postStatistics": "贴文数据",
    },
    "zh-TW": {
        "openInApp": "在 App 中開啟",
        "seeRest": "開啟 Postervia 查看更多",
        "readFull": "展開全文",
        "showLess": "收合",
        "comments": "留言",
        "viewAllComments": "在 App 中查看全部 {count} 則留言",
        "showReplies": "在 App 中查看全部 {count} 則回覆",
        "helpful": "有幫助",
        "saves": "收藏",
        "mediaAlt": "{author} 的第 {current} 張圖片，共 {total} 張",
        "appStore": "前往 App Store 下載",
        "playStore": "前往 Google Play 下載",
        "unavailableTitle": "在 Postervia 中繼續",
        "unavailableBody": "這篇分享貼文暫時無法在網頁中查看。開啟 Postervia 繼續探索。",
        "brandTagline": "分享在地路徑",
        "mediaLabel": "貼文圖片",
        "postStatistics": "貼文數據",
    },
    "ar": {
        "openInApp": "فتح في التطبيق",
        "seeRest": "شاهد الباقي في Postervia",
        "readFull": "قراءة المنشور كاملاً",
        "showLess": "عرض أقل",
        "comments": "التعليقات",
        "viewAllComments": "عرض كل التعليقات ({count}) في التطبيق",
        "showReplies": "عرض كل الردود ({count}) في التطبيق",
        "helpful": "مفيد",
        "saves": "المحفوظات",
        "mediaAlt": "الصورة {current} من {total} بواسطة {author}",
        "appStore": "تنزيل من App Store",
        "playStore": "تنزيل من Google Play",
        "unavailableTitle": "المتابعة في Postervia",
        "unavailableBody": (
            "هذا المنشور المشترك غير متاح على الويب. "
            "افتح Postervia لمتابعة الاستكشاف."
        ),
        "brandTagline": "مسارات محلية نتشاركها",
        "mediaLabel": "صور المنشور",
        "postStatistics": "إحصاءات المنشور",
    },
}


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("\"'")
    return values


def read_languages() -> list[dict[str, str]]:
    source = SITE_I18N_PATH.read_text(encoding="utf-8")
    match = re.search(r"const LANGUAGES = (\[.*?\]);\s+const TRANSLATIONS", source, re.S)
    if not match:
        raise RuntimeError("Could not parse LANGUAGES from site-i18n.js")
    return json.loads(match.group(1))


def output_locale(code: str) -> str:
    if code == "zh":
        return "zh-CN"
    return code


def translate(locale: str, language_name: str, api_key: str, model: str) -> dict[str, str]:
    keys = list(ENGLISH)
    values = [ENGLISH[key] for key in keys]
    response_type = create_model(
        f"ShareChrome_{locale.replace('-', '_')}",
        __config__=ConfigDict(extra="forbid"),
        translations=(conlist(str, min_length=len(values), max_length=len(values)), ...),
    )
    client = OpenAI(api_key=api_key)
    response = client.responses.parse(
        model=model,
        instructions=(
            "Translate concise mobile web UI strings into the requested language. "
            "Preserve Postervia, App Store, Google Play, App, and every placeholder "
            "such as {count}, {current}, {total}, and {author} exactly. "
            "Use natural product language, not word-for-word translation."
        ),
        input=json.dumps(
            {
                "target_locale": locale,
                "target_language": language_name,
                "strings": values,
            },
            ensure_ascii=False,
        ),
        text_format=response_type,
        max_output_tokens=3000,
        prompt_cache_key=f"legal-web:share-chrome:v1:{model}:{locale}",
        truncation="disabled",
    )
    parsed = response.output_parsed
    if parsed is None:
        raise RuntimeError(f"No parsed translation for {locale}")
    translated = dict(zip(keys, parsed.translations, strict=True))
    for placeholder in ("count", "current", "total", "author"):
        source_keys = [key for key, value in ENGLISH.items() if f"{{{placeholder}}}" in value]
        for key in source_keys:
            if f"{{{placeholder}}}" not in translated[key]:
                raise RuntimeError(f"{locale}.{key} lost {{{placeholder}}}")
    return translated


def write_output(copy: dict[str, dict[str, str]], locale_order: list[str]) -> None:
    ordered = {locale: copy[locale] for locale in locale_order if locale in copy}
    payload = json.dumps(ordered, ensure_ascii=False, indent=2)
    OUTPUT_PATH.write_text(
        "// Auto-generated by scripts/generate-share-translations.py\n"
        f"export const SHARE_COPY = {payload};\n",
        encoding="utf-8",
    )


def main() -> None:
    env = read_env()
    api_key = env.get("OPENAI_API_KEY", "")
    model = env.get("OPENAI_MODEL", "gpt-5.4-mini")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required")

    languages = read_languages()
    language_names: dict[str, str] = {}
    locale_order: list[str] = []
    for language in languages:
        locale = output_locale(language["code"])
        if locale not in language_names:
            language_names[locale] = language["name"]
            locale_order.append(locale)

    copy = {locale: value.copy() for locale, value in MANUAL.items()}
    write_output(copy, locale_order)
    pending = [
        (locale, language_names[locale])
        for locale in locale_order
        if locale not in copy
    ]
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(translate, locale, name, api_key, model): locale
            for locale, name in pending
        }
        for index, future in enumerate(as_completed(futures), start=1):
            locale = futures[future]
            for attempt in range(3):
                try:
                    copy[locale] = future.result() if attempt == 0 else translate(
                        locale, language_names[locale], api_key, model
                    )
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
            write_output(copy, locale_order)
            print(f"[{index}/{len(pending)}] {locale}", flush=True)

    missing = [locale for locale in locale_order if locale not in copy]
    if missing:
        raise RuntimeError(f"Missing locales: {', '.join(missing)}")
    print(f"Wrote {len(copy)} locales to {OUTPUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
