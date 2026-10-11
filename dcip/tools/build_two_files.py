#!/usr/bin/env python3
"""Builds the two single-file pages (dist/index.html = applicants, dist/admin.html = admin) from web/.
Run:  python3 tools/build_two_files.py"""
import base64, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, 'web'); OUT = os.path.join(ROOT, 'dist')
def read(p, mode='r'):
    with open(os.path.join(W, p), mode, **({'encoding': 'utf-8'} if mode == 'r' else {})) as f: return f.read()
def js(code): return code.replace('</script', '<\\/script')
logo = 'data:image/png;base64,' + base64.b64encode(read('logo.png', 'rb')).decode()

CONFIG = ("<script>\n// ====== PASTE YOUR GOOGLE APPS SCRIPT WEB-APP URL BETWEEN THE QUOTES (it ends in /exec) ======\n"
          "window.DCIP_CONFIG = { apiUrl: '__API_URL__' };\n// ================================================================================\n</script>")

def build(page, scripts, css_files):
    html = read(page)
    css = '\n'.join(read(c) for c in css_files)
    html = re.sub(r'<link rel="stylesheet" href="[^"]+">\s*', '', html)
    html = html.replace('<link rel="icon" href="logo.png">', '<link rel="icon" href="%s">' % logo)
    html = html.replace('</head>', '<style>\n%s\n</style>\n</head>' % css, 1)
    html = html.replace('src="logo.png"', 'src="%s"' % logo)
    html = re.sub(r'\s*<script src="[^"]+"></script>', '', html)          # drop external script tags
    body = CONFIG + '\n' + '\n'.join('<script>\n%s\n</script>' % js(read(s)) for s in scripts)
    html = html.replace('</body>', body + '\n</body>')
    return html

API_URL = (sys.argv[1] if len(sys.argv) > 1 else '')
os.makedirs(OUT, exist_ok=True)
pages = {
  'index.html': build('index.html', ['common.js', 'lists.js', 'register.js'], ['styles.css']),
  'admin.html': build('admin.html', ['vendor/exceljs.min.js', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js',
                                      'common.js', 'insights.js', 'reports.js', 'admin-core.js', 'admin-reports.js', 'admin-views.js', 'admin-boot.js'],
                      ['styles.css', 'admin.css']),
}
for name, html in pages.items():
    html = html.replace('__API_URL__', API_URL)
    assert 'src="logo.png"' not in html and 'href="styles.css"' not in html
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f: f.write(html)
    print(name, round(len(html) / 1024), 'KB')
