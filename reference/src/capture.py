"""Render frames of the Babylon.js scene with headless Chrome (SwiftShader WebGL).
usage: python src/capture.py <start> <end> [step]
writes frames/f%04d.png at the reference/ root
"""
import base64, sys, pathlib, json, os
from playwright.sync_api import sync_playwright

start = int(sys.argv[1]); end = int(sys.argv[2]); step = int(sys.argv[3]) if len(sys.argv) > 3 else 1
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "frames"; OUT.mkdir(parents=True, exist_ok=True)

ARGS = [
    "--no-sandbox", "--disable-gpu-sandbox", "--use-gl=angle",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage", "--hide-scrollbars",
]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/local/bin/chromium"), headless=True, args=ARGS)
    page = browser.new_page(viewport={"width": 720, "height": 1280}, device_scale_factor=1)
    errs = []
    page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    page.goto((HERE / "scene.html").as_uri())
    try:
        page.wait_for_function("window.__ready === true", timeout=60000)
    except Exception:
        print(json.dumps({"fatal": "scene never became ready", "log": errs[:20]})); sys.exit(1)

    # the very first captured frame after load can carry a stale texture upload: throw one away
    page.evaluate("f => window.renderFrame(f)", start)

    for f in range(start, end + 1, step):
        data = page.evaluate("f => window.renderFrame(f)", f)
        b64 = data.split(",", 1)[1]
        (OUT / f"f{f:04d}.png").write_bytes(base64.b64decode(b64))
    if errs:
        print(json.dumps({"warnings": errs[:10]}))
    print(json.dumps({"ok": True, "frames": list(range(start, end + 1, step))[:3] + ["..."],
                      "n": len(range(start, end + 1, step))}))
    browser.close()
