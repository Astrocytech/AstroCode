#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os
import subprocess
import shutil

os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/changelog.txt", 'w') as f:
    f.write("")

subprocess.run(["git", "add", "."])
subprocess.run(["git", "commit", "-m", "\"Initial commit\""])

changelog_content = subprocess.check_output(['git', 'log']).decode('utf-8')
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/changelog.txt", 'w') as f:
    f.write(changelog_content)

os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing", exist_ok=True)
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/original.txt", 'w') as f:
    f.write(changelog_content)

# Prepend something
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/new.txt", 'r') as rf:
    new_content = rf.read()
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/original.txt", 'r') as rf:
    old_content = rf.read()
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/new_original.txt", 'w') as wf:
    wf.write(new_content + old_content)

# Append something
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/original.txt", 'a') as f:
    f.write("New line appended")

# Replace something
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/original.txt", 'r') as rf:
    old_content = rf.read()
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/editing/new_original.txt", 'w') as wf:
    wf.write(old_content.replace("Append something", "Replace something"))