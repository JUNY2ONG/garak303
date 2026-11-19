"""v2 3D 스크린샷. 사용: python3 shot3d.py <step,step,...> [d|m|ml,...] [query]
step: 방 id(all, plan, entry, living, ...) 또는 js:<식>:<이름>  (식은 window.__house 를 h 로 씀)"""
import asyncio, sys, time
from playwright.async_api import async_playwright
BASE = "file:///home/claude/house-v2/out/house-3d.html"
SIZES = {"d": ({"width": 1280, "height": 800}, 1, False), "m": ({"width": 390, "height": 844}, 2, True), "ml": ({"width": 844, "height": 390}, 2, True)}
async def main():
    steps = [s.strip() for s in sys.argv[1].split("|")]
    sizes = sys.argv[2].split(",") if len(sys.argv) > 2 else ["d"]
    query = sys.argv[3] if len(sys.argv) > 3 else "q=high"
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome",
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        for sz in sizes:
            vp, dsf, touch = SIZES[sz]
            ctx = await b.new_context(viewport=vp, device_scale_factor=dsf, has_touch=touch, is_mobile=touch)
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
            pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") and "GPU stall" not in m.text else None)
            t0 = time.time()
            await pg.goto(BASE + "?" + query)
            await pg.wait_for_function("window.__ready === true", timeout=90000)
            print(sz, "ready in %.1fs" % (time.time() - t0))
            await pg.wait_for_timeout(1500)
            for st in steps:
                if st.startswith("js:"):
                    _, expr, name = st.split(":", 2)
                    await pg.evaluate("(()=>{const h=window.__house;" + expr + "})()")
                    await pg.wait_for_timeout(2600)
                elif st.startswith("go:"):
                    _, vid, name = st.split(":", 2)
                    await pg.evaluate(f"window.__house.goSpace(\"{vid}\", true)")
                    await pg.wait_for_timeout(2000)
                elif st.startswith("click:"):
                    _, sel, name = st.split(":", 2)
                    await pg.click(sel)
                    await pg.wait_for_timeout(2600)
                elif st.startswith("tap:"):
                    _, xy, name = st.split(":", 2)
                    x, y = [float(v) for v in xy.split("/")]
                    await pg.mouse.click(x, y)
                    await pg.wait_for_timeout(2600)
                else:
                    name = st
                    await pg.click(f'#rooms button[data-v="{st}"]')
                    await pg.wait_for_timeout(3200)
                if name != "-":
                    await pg.screenshot(path=f"/home/claude/house-v2/shots/{sz}_{name}.png")
            print(sz, "tier:", await pg.evaluate("window.__house.tierName()"), "post:", await pg.evaluate("window.__house.post.active"), "errors:", errs)
            await ctx.close()
        await b.close()
asyncio.run(main())
