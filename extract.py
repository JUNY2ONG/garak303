"""house-3d.html 에서 모든 소스를 꺼낸다.  사용: python3 extract.py house-3d.html [꺼낼 폴더=house-src]
그다음:  cd house-src && python3 build.py  →  out/house-3d.html, out/house-plan.html"""
import pathlib, re, sys

html = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
dst = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "house-src")
END = "</scr" + "ipt"
files = {}
# 글 덩어리 먼저 꺼내고 지운 뒤(그 안에도 경계 표시 글자가 있으므로) 실행 스크립트 안의 소스를 찾는다
pat = re.compile(r'<script type="text/plain" data-file="([^"]+)"[^>]*>\n(.*?)\n' + END + ">", re.S)
for m in pat.finditer(html):
    files[m.group(1)] = m.group(2).replace("<" + chr(92) + "/script", END)
rest = pat.sub("", html)
for m in re.finditer(r"/\* ==== FILE: (.+?) ==== \*/\n(.*?)\n/\* ==== END FILE: \1 ==== \*/", rest, re.S):
    files[m.group(1)] = m.group(2)
for rel, text in files.items():
    p = dst / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    print(rel, len(text.encode("utf-8")))
print(len(files), "files →", dst)
