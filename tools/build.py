#!/usr/bin/env python3
"""Keep the shared and data-driven parts of the site in sync.

Pages in public/ contain marked regions:

    <!-- build:NAME -->
    ...generated: do not edit by hand...
    <!-- /build:NAME -->

This script regenerates every region from partials/ and content/, refreshes
the search index inside public/assets/js/search.js and rewrites
public/sitemap.xml. Everything outside the markers is left alone.

    py tools/build.py           update files in place
    py tools/build.py --check   list out-of-date files without writing (exit 1)

Standard library only; works with Python 3.8+.
"""

import argparse
import datetime
import html
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
CONTENT = ROOT / "content"
PARTIALS = ROOT / "partials"
SEARCH_JS = PUBLIC / "assets" / "js" / "search.js"
SITEMAP = PUBLIC / "sitemap.xml"

LANGS = ("en", "zh")

# Page file -> key of its link in partials/nav.html ({{nav:KEY}}).
NAV_KEYS = {
    "index.html": "home",
    "research.html": "research",
    "publications.html": "publications",
    "teaching.html": "teaching",
    "news.html": "news",
}
# Sitemap order; other indexable pages follow alphabetically.
PAGE_ORDER = ["index.html", "research.html", "publications.html", "teaching.html", "news.html"]

HTML_REGION = re.compile(
    r"^(?P<indent>[ \t]*)<!-- build:(?P<name>[\w-]+) -->[ \t]*\n"
    r"(?P<body>.*?)"
    r"^(?P=indent)<!-- /build:(?P=name) -->",
    re.M | re.S,
)
HTML_OPENING = re.compile(r"<!-- build:[\w-]+ -->")
JS_REGION = re.compile(
    r"^(?P<indent>[ \t]*)// build:(?P<name>[\w-]+)\b[^\n]*\n"
    r"(?P<body>.*?)"
    r"^(?P=indent)// /build:(?P=name)\b",
    re.M | re.S,
)
JS_OPENING = re.compile(r"// build:[\w-]+")

# status -> (label, extra CSS class, listed under "Published Work")
STATUSES = {
    "published": ({"en": "Published · {date}", "zh": "已发表 · {date}"}, "", True),
    "accepted": ({"en": "Accepted · {date}", "zh": "已接收 · {date}"}, "", True),
    "in-progress": ({"en": "In progress", "zh": "进行中"}, " status-in-progress", False),
    "planned": ({"en": "Planned direction", "zh": "计划方向"}, " status-planned", False),
}


class BuildError(Exception):
    """A problem in content/, partials/ or a page that the author has to fix."""


# --------------------------------------------------------------------------
# Text helpers

def read(path):
    """Return the file's text with \\n line endings, plus the newline it uses on disk."""
    raw = path.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), ("\r\n" if "\r\n" in raw else "\n")


def load_json(name):
    path = CONTENT / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise BuildError("content/{}: invalid JSON ({})".format(name, error))


def attr(value):
    """Escape a value for a double-quoted HTML attribute."""
    return value.replace("&", "&amp;").replace('"', "&quot;")


def escape(value):
    return html.escape(value, quote=False)


def is_i18n(value):
    return isinstance(value, dict) and "en" in value


def in_lang(value, lang):
    """Plain text of a string or {"en", "zh"} value in one language."""
    if not is_i18n(value):
        return value
    result = value.get(lang) or value["en"]
    if value.get("html"):
        result = html.unescape(re.sub(r"<[^>]+>", "", result))
    return result


def both(value):
    return {lang: in_lang(value, lang) for lang in LANGS}


def element(tag, value, cls="", extra=""):
    """Render <tag> from a plain string, or bilingually from {"en", "zh"}.

    Strings are text. A dict with "html": true holds markup (links, <em>) and is
    switched with data-i18n-html instead of data-i18n.
    """
    open_tag = "<{}{}{}".format(tag, ' class="{}"'.format(cls) if cls else "", extra)
    if not is_i18n(value):
        return "{}>{}</{}>".format(open_tag, escape(value), tag)
    zh = value.get("zh") or value["en"]
    if value.get("html"):
        return '{} data-i18n-html data-en="{}" data-zh="{}">{}</{}>'.format(
            open_tag, attr(value["en"]), attr(zh), value["en"], tag)
    return '{} data-i18n data-en="{}" data-zh="{}">{}</{}>'.format(
        open_tag, attr(value["en"]), attr(zh), escape(value["en"]), tag)


def stack(blocks, gap=True):
    """Join multi-line blocks, with a blank line between them unless gap is False."""
    lines = []
    for block in blocks:
        if lines and gap:
            lines.append("")
        lines.extend(block)
    return lines


def require(item, keys, what):
    missing = [key for key in keys if key not in item]
    if missing:
        raise BuildError("{}: missing {}".format(what, ", ".join(missing)))


# --------------------------------------------------------------------------
# Publications, news, teaching

def status_of(pub):
    status = pub.get("status")
    if status not in STATUSES:
        raise BuildError("publication {!r}: status must be one of {}".format(
            pub.get("id"), ", ".join(STATUSES)))
    return STATUSES[status]


def publication_card(pub, detailed):
    require(pub, ("title", "status"), "publication {!r}".format(pub.get("id")))
    label, status_class, _ = status_of(pub)
    status = {lang: label[lang].format(date=pub.get("date", "")).rstrip(" ·") for lang in LANGS}

    venue = None
    if pub.get("journal"):
        parts = ["<em>{}</em>".format(escape(pub["journal"]))]
        parts += [escape(pub[key]) for key in ("year", "pages", "type") if pub.get(key)]
        venue = '<p class="pub-venue">{}</p>'.format(" · ".join(parts))
    elif pub.get("subtitle"):
        venue = element("p", pub["subtitle"], "pub-venue")
    authors = '<p class="pub-authors">{}</p>'.format(escape(pub["authors"])) if pub.get("authors") else None

    links = [("https://doi.org/" + pub["doi"], "DOI: " + pub["doi"])] if pub.get("doi") else []
    links += [(link["url"], link["label"]) for link in pub.get("links", [])]
    anchors = ['<a class="pub-link" href="{}" target="_blank" rel="noopener">{}</a>'.format(
        attr(url), escape(text)) for url, text in links]

    lines = [element("p", status, "pub-status" + status_class), element("h3", pub["title"])]
    if detailed:
        lines += [line for line in (authors, venue) if line]
        if pub.get("description"):
            lines.append(element("p", pub["description"], "pub-description"))
        if anchors:
            lines.append('<div class="publication-actions">{}</div>'.format("".join(anchors)))
        cls = "publication-card publication-card-detailed"
    else:
        lines += [line for line in (venue, authors) if line] + anchors
        cls = "publication-card"
    return ['<article class="{}">'.format(cls)] + ["  " + line for line in lines] + ["</article>"]


def news_item(item):
    require(item, ("date", "title", "body"), "news item {!r}".format(item.get("date")))
    label = item.get("label", item["date"])
    return [
        '<article class="news-item">',
        "  " + element("time", label, extra=' datetime="{}"'.format(attr(item["date"]))),
        "  <div>",
        "    " + element("h3", item["title"]),
        "    " + element("p", item["body"]),
        "  </div>",
        "</article>",
    ]


def teaching_card(course):
    require(course, ("code", "term", "title", "institution", "role"), "course {!r}".format(course.get("code")))
    meta = {lang: "{} · {}".format(in_lang(course["institution"], lang), in_lang(course["role"], lang))
            for lang in LANGS}
    return [
        '<article class="teaching-card">',
        '  <div class="teaching-card-header">',
        '    <span class="teaching-code">{}</span>'.format(escape(course["code"])),
        "    " + element("span", course["term"], "teaching-term"),
        "  </div>",
        "  " + element("h3", course["title"]),
        "  " + element("p", meta, "teaching-meta"),
        "</article>",
    ]


def search_entry(category, title, excerpt, keywords, href):
    return {"category": both(category), "title": both(title), "excerpt": both(excerpt),
            "keywords": keywords, "href": href}


def search_index(data):
    items = []
    for entry in data["search"]:
        require(entry, ("category", "title", "excerpt", "href"), "content/search.json entry")
        items.append(search_entry(entry["category"], entry["title"], entry["excerpt"],
                                  entry.get("keywords", ""), entry["href"]))

    for pub in data["publications"]:
        require(pub, ("title", "status"), "publication {!r}".format(pub.get("id")))
        title = pub["title"]
        if not is_i18n(title):
            title = {"en": title, "zh": pub.get("title_zh") or title}
        if status_of(pub)[2]:
            journal, date = pub.get("journal", ""), pub.get("date", "")
            if pub["status"] == "published":
                excerpt = {"en": "Published in {}{}.".format(journal, " on " + date if date else ""),
                           "zh": "发表于 {}{}。".format(journal, "，发表日期为 " + date if date else "")}
            else:
                excerpt = {"en": "Accepted for publication in {}.".format(journal),
                           "zh": "已被 {} 接收。".format(journal)}
            category, href = {"en": "Publication", "zh": "论文"}, "publications.html#published-work"
        else:
            excerpt = pub.get("description") or pub.get("subtitle") or ""
            category, href = {"en": "Current work", "zh": "当前研究"}, "publications.html#current-work"
        keywords = " ".join(part for part in (pub.get("keywords", ""), "DOI " + pub["doi"] if pub.get("doi") else "") if part)
        items.append(search_entry(category, title, excerpt, keywords, href))

    for course in data["teaching"]:
        require(course, ("code", "term", "title", "institution", "role"), "course {!r}".format(course.get("code")))
        title = {lang: "{} · {}".format(course["code"], in_lang(course["title"], lang)) for lang in LANGS}
        excerpt = {
            "en": "{} at {}, {}.".format(*(in_lang(course[key], "en") for key in ("role", "institution", "term"))),
            "zh": "{} {}，{}。".format(*(in_lang(course[key], "zh") for key in ("institution", "role", "term"))),
        }
        items.append(search_entry({"en": "Teaching", "zh": "教学"}, title, excerpt,
                                  course.get("keywords", ""), "teaching.html#teaching-experience"))

    for item in data["news"]:
        require(item, ("date", "title", "body"), "news item {!r}".format(item.get("date")))
        items.append(search_entry({"en": "News", "zh": "动态"}, item["title"], item["body"],
                                  item.get("keywords", ""), "news.html#news-list"))
    return items


# --------------------------------------------------------------------------
# Regions

def partial(name):
    path = PARTIALS / name
    if not path.exists():
        raise BuildError("missing partials/{}".format(name))
    return read(path)[0].rstrip("\n").split("\n")


def nav_for(page):
    current = NAV_KEYS.get(page)

    def link(match):
        if match.group(1) == current:
            return 'class="nav-link active" aria-current="page"'
        return 'class="nav-link"'

    return [re.sub(r"\{\{nav:(\w+)\}\}", link, line) for line in partial("nav.html")]


def page_region(name, page, data):
    pubs = data["publications"]
    renderers = {
        "head": lambda: partial("head.html"),
        "nav": lambda: nav_for(page),
        "sidebar": lambda: partial("sidebar.html"),
        "footer": lambda: partial("footer.html"),
        "scripts": lambda: partial("scripts.html"),
        "selected-publications": lambda: stack(
            [publication_card(p, False) for p in pubs if p.get("selected")], gap=False),
        "published-work": lambda: stack([publication_card(p, True) for p in pubs if status_of(p)[2]]),
        "current-work": lambda: stack([publication_card(p, True) for p in pubs if not status_of(p)[2]]),
        "news": lambda: stack([news_item(item) for item in data["news"]]),
        "teaching": lambda: stack([teaching_card(course) for course in data["teaching"]]),
    }
    if name not in renderers:
        raise BuildError("{}: unknown region build:{}".format(page, name))
    return renderers[name]()


def js_region(name, items, filename):
    if name != "search-index":
        raise BuildError("{}: unknown region build:{}".format(filename, name))
    return ("const items = " + json.dumps(items, ensure_ascii=False, indent=2) + ";").split("\n")


def fill(source, pattern, opening, render, filename):
    expected = len(opening.findall(source))
    found = []

    def replace(match):
        found.append(match.group("name"))
        indent = match.group("indent")
        lines = render(match.group("name"))
        for line in lines:
            if "{{" in line:
                raise BuildError("{}: unresolved placeholder in build:{}: {}".format(
                    filename, match.group("name"), line.strip()))
        body = "".join((indent + line).rstrip() + "\n" if line else "\n" for line in lines)
        whole = match.string
        return whole[match.start():match.start("body")] + body + whole[match.end("body"):match.end()]

    result = pattern.sub(replace, source)
    if len(found) != expected:
        raise BuildError("{}: a build marker has no matching closing marker".format(filename))
    return result


# --------------------------------------------------------------------------
# Sitemap

def git(*args):
    try:
        result = subprocess.run(["git"] + list(args), cwd=str(ROOT), capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.decode("utf-8", "replace").strip()


def lastmod(path, rewritten, previous, loc, today):
    """Today if the page changed and is not committed yet; otherwise keep the last known date."""
    relative = path.relative_to(ROOT).as_posix()
    if rewritten:
        return today
    status = git("status", "--porcelain", "--", relative)
    if status is None or status:
        return today
    return previous.get(loc) or git("log", "-1", "--format=%cs", "--", relative) or today


def sitemap_xml(pages, rewritten):
    previous = {}
    if SITEMAP.exists():
        previous = dict(re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", read(SITEMAP)[0]))
    today = datetime.date.today().isoformat()
    rank = {name: index for index, name in enumerate(PAGE_ORDER)}
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for name in sorted(pages, key=lambda page: (rank.get(page, len(rank)), page)):
        text = pages[name]
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', text)
        if not canonical or re.search(r'<meta name="robots" content="[^"]*noindex', text):
            continue
        loc = canonical.group(1)
        lines += ["  <url>",
                  "    <loc>{}</loc>".format(loc),
                  "    <lastmod>{}</lastmod>".format(lastmod(PUBLIC / name, name in rewritten, previous, loc, today)),
                  "  </url>"]
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------

def build():
    """Return {path: (new_text, old_text, newline)} for every generated file."""
    data = {name: load_json(name + ".json") for name in ("publications", "news", "teaching", "search")}
    outputs = {}

    old, newline = read(SEARCH_JS)
    items = search_index(data)
    new = fill(old, JS_REGION, JS_OPENING, lambda name: js_region(name, items, SEARCH_JS.name), SEARCH_JS.name)
    outputs[SEARCH_JS] = (new, old, newline)

    pages, rewritten = {}, set()
    for path in sorted(PUBLIC.glob("*.html")):
        old, newline = read(path)
        new = fill(old, HTML_REGION, HTML_OPENING,
                   lambda name, page=path.name: page_region(name, page, data), path.name)
        outputs[path] = (new, old, newline)
        pages[path.name] = new
        if new != old:
            rewritten.add(path.name)

    old, newline = read(SITEMAP) if SITEMAP.exists() else ("", "\n")
    outputs[SITEMAP] = (sitemap_xml(pages, rewritten), old, newline)
    return outputs


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except AttributeError:
            pass

    parser = argparse.ArgumentParser(description="Sync partials/ and content/ into public/.")
    parser.add_argument("--check", action="store_true",
                        help="only report out-of-date files; exit 1 if there are any")
    args = parser.parse_args()

    try:
        outputs = build()
    except BuildError as error:
        print("error: {}".format(error), file=sys.stderr)
        return 2

    stale = [path for path, (new, old, _) in outputs.items() if new != old]
    for path in stale:
        name = path.relative_to(ROOT).as_posix()
        if args.check:
            print("out of date: " + name)
            continue
        new, _, newline = outputs[path]
        path.write_bytes(new.replace("\n", newline).encode("utf-8"))
        print("updated " + name)
    if not stale:
        print("everything is up to date")
    return 1 if args.check and stale else 0


if __name__ == "__main__":
    sys.exit(main())
