#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directory if not exists
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Write files
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/contents.txt", 'w') as f:
    f.write("This is contents of the file")

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/results.txt", 'w') as f:
    f.write("This is results of the file")

# Prepend to setti.txt if it exists
if os.path.exists("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/setti.txt"):
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/setti.txt", 'r') as f:
        content = f.read()
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/setti.txt", 'w') as f:
        f.write("This is prepend content" + "\n\n" + content)
else:
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/setti.txt", 'w') as f:
        f.write("This is prepend content")

# Commit changes
os.system('git add . && git commit -m "Added files in hardening directory"')