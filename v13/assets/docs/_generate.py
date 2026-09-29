import re, html
S="/private/tmp/claude-501/-Users-elianora-Desktop---------------------------/c2acefd5-f116-4e20-98ce-6d49165d8886/scratchpad/docs/"
OUT="/Users/elianora/Desktop/Портфолио/Ангелина Продажи/hero-arc/v12/"
EMAIL="hello@gg-agency.ru"
DOCS=[
 dict(src="Политика конфиденциальности", file="privacy.html", pdf="politika-konfidencialnosti.pdf", kind="policy",
      pill="Документ", title="Политика в отношении обработки персональных данных", short="Политика конфиденциальности", skip=3, meta="Действует с 15 сентября 2026 г."),
 dict(src="Согласие на обработку персональных данных", file="consent.html", pdf="soglasie-na-obrabotku-dannyh.pdf", kind="consent",
      pill="Документ", title="Согласие на обработку персональных данных", short="Согласие на обработку персональных данных", skip=2, meta="В соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных»",
      heads=["Данные Субъекта персональных данных","Текст согласия","Подпись Субъекта"]),
 dict(src="Согласие на рассылки", file="mailing.html", pdf="soglasie-na-rassylki.pdf", kind="consent",
      pill="Документ", title="Согласие на получение рекламной и информационной рассылки", short="Согласие на рассылки", skip=3, meta="Согласие на получение сообщений по сетям электросвязи",
      heads=["Данные Субъекта","Условия согласия","Подпись"]),
]
def typo(t):
    t=html.escape(t, quote=False)
    t=t.replace("[указать контактный e-mail]",'<a href="mailto:%s">%s</a>'%(EMAIL,EMAIL))
    t=t.replace("[указать контактный\ne-mail]",'<a href="mailto:%s">%s</a>'%(EMAIL,EMAIL))
    t=t.replace("[указать адрес сайта]",'<span data-site>GG Agency</span>')
    # неразрывный пробел после коротких слов и перед тире
    t=re.sub(r'(?<![\w>])([вВиИкКсСоОуУаА]|на|по|не|за|от|до|из|ни|во|со|об|№|г\.|ул\.|д\.|кв\.) ', lambda m:m.group(1)+'&nbsp;', t)
    t=t.replace(" — ","&nbsp;— ")
    return t
def blocks(raw, doc):
    lines=[l.strip() for l in raw.replace("\f","\n").split("\n")]
    lines=[l for l in lines if l][doc["skip"]:]
    # склейка «—» на отдельной строке со следующей
    fixed=[]; i=0
    while i<len(lines):
        if lines[i]=="—" and i+1<len(lines): fixed.append("— "+lines[i+1]); i+=2
        else: fixed.append(lines[i]); i+=1
    lines=fixed
    out=[]; cur=None
    def flush():
        nonlocal cur
        if cur: out.append(cur); cur=None
    heads=set(doc.get("heads",[]))
    n=0
    for l in lines:
        n+=1
        isfield = "____" in l
        if doc["kind"]=="policy" and re.match(r'^\d+\. [А-ЯA-Z]', l) and not l.endswith(".") and len(l)<90:
            flush(); cur=dict(t="h2", s=l); continue
        if cur and cur["t"]=="h2" and doc["kind"]=="policy" and not re.match(r'^\d+\.\d+\.',l) and not l.startswith("—"):
            # продолжение длинного заголовка раздела
            cur["s"]+=" "+l; continue
        if l in heads: flush(); out.append(dict(t="h2", s=l)); continue
        if isfield:
            flush(); label=l.split("____")[0].strip().rstrip(":")
            if label: out.append(dict(t="field", s=label))
            elif out and out[-1]["t"]=="p" and out[-1]["s"].endswith(":"):
                # линия под заполнение относится к подписи строкой выше
                out[-1]=dict(t="field", s=out[-1]["s"].rstrip(":"))
            continue
        if l.startswith("—"): flush(); cur=dict(t="li", s=l[1:].strip()); continue
        if re.match(r'^\d+(\.\d+)?\. ', l): flush(); cur=dict(t="p", s=l, num=True); continue
        if re.match(r'^\(далее', l): flush(); cur=dict(t="p", s=l); continue
        if cur is None: cur=dict(t="p", s=l)
        elif cur["t"]=="li" and doc["kind"]=="policy" and re.match(r'^(ИНН|Адрес:|Сайт:|E-mail:|Индивидуальный предприниматель)', l):
            flush(); cur=dict(t="p", s=l)
        elif doc["kind"]=="policy" and cur["t"]=="p" and re.match(r'^(ИНН \d|Адрес: \d|Сайт:|E-mail:|Индивидуальный предприниматель Глазкова Ангелина Викторовна \(ИП Глазкова А\.В\.\)$)', l):
            flush(); cur=dict(t="p", s=l, tight=True)
        else: cur["s"]+=" "+l
    flush()
    return out
for doc in DOCS:
    raw=open(S+doc["src"]+".raw.txt",encoding="utf8").read()
    bl=blocks(raw, doc)
    meta=doc["meta"]; head=[]
    body=[]; toc=[]; i=0; hid=0
    while i<len(bl):
        b=bl[i]
        if b["t"]=="h2":
            hid+=1; anchor="p%d"%hid
            if "контактная информация" in b["s"]: anchor="contacts"
            toc.append((anchor,b["s"]))
            body.append('<h2 id="%s">%s</h2>'%(anchor,typo(b["s"])))
        elif b["t"]=="li":
            items=[]
            while i<len(bl) and bl[i]["t"]=="li": items.append("<li>%s</li>"%typo(bl[i]["s"])); i+=1
            body.append("<ul>\n"+"\n".join(items)+"\n</ul>"); continue
        elif b["t"]=="field":
            items=[]
            while i<len(bl) and bl[i]["t"]=="field": items.append("<div><dt>%s</dt><dd></dd></div>"%typo(bl[i]["s"])); i+=1
            body.append('<dl class="legal__fields">\n'+"\n".join(items)+"\n</dl>"); continue
        else:
            s=typo(b["s"])
            s=re.sub(r'^(\d+(?:\.\d+)?\.)&nbsp;|^(\d+(?:\.\d+)?\.) ', lambda m:"<b>%s</b> "%(m.group(1) or m.group(2)), s)
            body.append("<p>%s</p>"%s)
        i+=1
    others="\n".join('        <li><a href="%s">%s</a></li>'%(d["file"],d["short"]) for d in DOCS if d is not doc)
    tochtml=""
    if doc["kind"]=="policy":
        tochtml='      <ol class="legal__toc" role="list">\n'+"\n".join('        <li><a href="#%s">%s</a></li>'%(a,typo(t)) for a,t in toc)+'\n      </ol>\n'
    page='''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>%(short)s — GG Agency</title>
<meta name="robots" content="noindex" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="styles.css" />
<link rel="stylesheet" href="legal.css" />
</head>
<body class="legal-body">

<header class="legal-top">
  <a class="legal-logo" href="index.html">GG AGENCY</a>
  <a class="legal-back" href="index.html"><span aria-hidden="true">←</span> На сайт</a>
</header>

<main class="legal">
  <aside class="legal__aside">
    <p class="legal__pill">%(pill)s</p>
    <h1 class="legal__title">%(title)s</h1>
    %(meta)s
%(toc)s  </aside>

  <article class="legal__text">
%(body)s

    <div class="legal__foot">
      <ul class="legal__others" role="list">
        <li><span>Другие документы</span></li>
%(others)s
      </ul>
      <a class="start__cta" href="assets/docs/%(pdf)s" download>
        <span class="start__cta-label">Скачать PDF</span>
        <span class="start__cta-icon" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.3779 0C11.7214 0.000234861 12 0.279723 12 0.624023V1.52441L11.248 2.27734C11.2308 2.29042 11.2137 2.30478 11.1982 2.32031L9.52246 4H11.999V12H8.99902V4.52441L1.54004 12L0 10.4561L7.19336 3.24707C7.58511 2.85416 7.30726 2.18262 6.75293 2.18262H0.0517578V0H11.3779Z" fill="currentColor"/></svg></span>
      </a>
    </div>
  </article>
</main>

<footer class="legal-bottom">
  <p>© GG Agency, 2026</p>
  <p>ИП Глазкова А.&nbsp;В. · ИНН 165807721000 · ОГРНИП 324169000113986</p>
</footer>

<script>
/* Адрес сайта в тексте документа — тот, на котором страница открыта */
(function () {
  if (!location.host) return;
  var host = location.host + (location.host.indexOf("github.io") > -1 ? location.pathname.replace(/[^/]*$/, "") : "");
  [].forEach.call(document.querySelectorAll("[data-site]"), function (el) { el.textContent = host; });
})();
</script>
</body>
</html>
''' % dict(short=doc["short"], pill=doc["pill"], title=doc["title"], meta=('<p class="legal__meta">%s</p>'%typo(meta)) if meta else "", toc=tochtml, body="\n".join("    "+x for x in body), others=others, pdf=doc["pdf"])
    open(OUT+doc["file"],"w",encoding="utf8").write(page)
    print(doc["file"], "blocks:",len(bl), "head:",head, "| meta:",meta, "| h2:",len(toc))
