#!/usr/bin/env python3
# Запуск: python3 tools/typograf.py index.html v2/index.html v3/index.html v3/main.js
"""Типограф: неразрывные пробелы после коротких слов, перед тире, между числом и единицей."""
import re,sys
NB=' '
SHORT=r'(?:а|и|в|во|к|ко|с|со|у|о|об|обо|но|на|не|ни|по|до|за|из|от|для|без|при|про|под|над|что|как|это|или|то|же|их|ее|её|мы|вы|он|её|я|вам|нас|вас|ваш|наш|при|раз|все|всё|при|два|три|пять|бы|ли|уже|тем|чем|где)'
def typo(t):
    # после короткого слова — неразрывный
    t=re.sub(r'(?<![0-9A-Za-zА-Яа-яЁё\-])('+SHORT+r') +(?=\S)', lambda m: m.group(1)+NB, t, flags=re.I)
    # частицы бы/ли/же — к предыдущему слову
    t=re.sub(r' (бы|ли|же)(?![А-Яа-яЁё])', NB+r'\1', t)
    # перед тире
    t=re.sub(r' +— ', NB+'— ', t)
    t=re.sub(r' +–', NB+'–', t)
    # число + единица / знак
    t=re.sub(r'(\d) +(мм|см|м|мкм|шт|₽|%|°|дн[яейь]+|рабоч|недел|месяц|часов|час|кг|г\b)', lambda m: m.group(1)+NB+m.group(2), t)
    t=re.sub(r'(\d) +(?=[А-Яа-яЁё])', r'\1'+NB, t)
    t=re.sub(r'(\d) (\d{3})(?!\d)', r'\1'+NB+r'\2', t)   # разряды
    return t

def html(s):
    out=[]; i=0
    for m in re.finditer(r'<(script|style)\b.*?</\1>|<[^>]+>', s, flags=re.S):
        txt=s[i:m.start()]
        txt=txt.replace('&nbsp;', NB)
        out.append(typo(txt).replace(NB,'&nbsp;'))
        out.append(m.group(0)); i=m.end()
    t=s[i:].replace('&nbsp;',NB); out.append(typo(t).replace(NB,'&nbsp;'))
    return ''.join(out)

def js(s):
    # только строковые литералы с кириллицей
    def f(m):
        q=m.group(1); body=m.group(2)
        if not re.search('[А-Яа-яЁё]',body) or '<' in body and 'class=' in body and len(re.sub('<[^>]+>','',body))<3: return m.group(0)
        # не трогаем html-теги внутри строки
        parts=re.split(r'(<[^>]+>)',body)
        body=''.join(p if p.startswith('<') else typo(p).replace(NB,'\\u00a0') for p in parts)
        return q+body+q
    return re.sub(r"(')((?:[^'\\\n]|\\.)*)'", f, s)

for path in sys.argv[1:]:
    s=open(path,encoding='utf8').read()
    n=html(s) if path.endswith('.html') else js(s)
    open(path,'w',encoding='utf8').write(n)
    print(path, s.count(' ')-n.count(' '), 'пробелов заменено')
