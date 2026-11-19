import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        for name, vp, dsf in [("pd", {"width": 1280, "height": 800}, 1), ("pm", {"width": 390, "height": 844}, 2)]:
            pg = await b.new_page(viewport=vp, device_scale_factor=dsf); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await pg.goto("file:///home/claude/house-v2/out/house-plan.html"); await pg.wait_for_function("window.__ready === true"); await pg.wait_for_timeout(300)
            box = await pg.evaluate("(()=>{const r=document.querySelector('.f-fridge').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
            await pg.mouse.click(box[0], box[1]); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"/home/claude/house-v2/shots/{name}.png"); print(name, "errors:", errs); await pg.close()
        await b.close()
asyncio.run(main())
