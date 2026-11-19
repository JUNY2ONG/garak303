"""우리집 3D / 평면도 빌드.  사용: python3 build.py
입력: src/, vendor/, HANDOFF.md (이 파일과 같은 폴더 기준)  →  출력: out/house-3d.html, out/house-plan.html
house-3d.html 안에는 모든 소스·라이브러리·인계 문서가 경계 표시와 함께 들어가므로 extract.py 로 다시 꺼낼 수 있다."""
import pathlib

root = pathlib.Path(__file__).resolve().parent
END = "</scr" + "ipt"


def rd(rel):
    return (root / rel).read_text(encoding="utf-8")


def js(rel):          # 실행되는 스크립트 안에 넣는 소스 (경계 주석 포함)
    src = rd(rel)
    assert END not in src and "<\\/script" not in src, rel
    return f"/* ==== FILE: {rel} ==== */\n{src}\n/* ==== END FILE: {rel} ==== */"


def plain(rel, extra=""):   # 실행되지 않는 글 덩어리 (</script 만 이스케이프)
    src = rd(rel)
    assert "<\\/script" not in src, rel
    return f'<script type="text/plain" data-file="{rel}"{extra}>\n{src.replace(END, "<" + chr(92) + "/script")}\n{END}>'


(root / "out").mkdir(exist_ok=True)
data = js("src/house-data.js")

# ---- 평면도 ----
out = rd("src/plan.html").replace("/*DATA*/", data).replace("/*PLAN*/", js("src/plan.js"))
(root / "out/house-plan.html").write_text(out, encoding="utf-8")
print("out/house-plan.html", len(out.encode("utf-8")))

# ---- 3D ----
parts = sorted(p.relative_to(root).as_posix() for p in (root / "src/3d").glob("*.js"))
app = "(function () {\n'use strict';\n" + "\n".join(js(p) for p in parts) + "\n})();\n"
bundle = "\n".join(
    [plain("HANDOFF.md", ' id="handoff"')]
    + [plain(p) for p in ["build.py", "extract.py", "shot3d.py", "shotplan.py", "src/house3d.html", "src/plan.html", "src/plan.js", "vendor/LICENSE-three.txt", "vendor/LICENSE-pathtracer.txt"]]
)
out3 = (rd("src/house3d.html")
        .replace("/*THREE*/", js("vendor/three.min.js"))
        .replace("/*ORBIT*/", js("vendor/OrbitControls.js"))
        .replace("/*ROOMENV*/", js("vendor/RoomEnvironment.js"))
        .replace("/*ROUNDED*/", js("vendor/RoundedBoxGeometry.js"))
        .replace("/*BGU*/", js("vendor/BufferGeometryUtils.js")).replace("/*PASS*/", js("vendor/Pass.js"))
        .replace("/*BVH*/", js("vendor/three-mesh-bvh.umd.js")).replace("/*PT*/", js("vendor/three-gpu-pathtracer.umd.js"))
        .replace("/*DATA*/", data).replace("/*APP*/", app)
        .replace("<!--BUNDLE-->", bundle))     # 묶음은 맨 마지막에 (그 안의 자리표시가 바뀌지 않게)
(root / "out/house-3d.html").write_text(out3, encoding="utf-8")
print("out/house-3d.html", len(out3.encode("utf-8")))
