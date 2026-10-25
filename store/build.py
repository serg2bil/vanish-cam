# Builds store/vanish-cam-store.zip for the Chrome Web Store: manifest.json at the zip root, no local sounds.
# (tar-made zips were rejected as "invalid package".) Run: python store/build.py
import os, zipfile
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src, out = os.path.join(root, 'vanish-cam'), os.path.join(root, 'store', 'vanish-cam-store.zip')
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, dirs, files in os.walk(src):
        dirs[:] = [x for x in dirs if not (d == src and x == 'sounds')]
        for f in files:
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, src).replace(os.sep, '/'))
n = zipfile.ZipFile(out).namelist()
assert 'manifest.json' in n
print(len(n), 'files,', os.path.getsize(out) // 1024, 'KB, first:', n[:3])
