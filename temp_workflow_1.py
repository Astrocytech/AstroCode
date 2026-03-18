#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os
from datetime import datetime

# Create directory if it doesn't exist
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# File 1: file1.txt
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file1.txt", 'w') as f:
    f.write("This is the content of file1")

# File 2: file2.txt
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file2.txt", 'w') as f:
    f.write("This is the content of file2")

# Append to file1.txt
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file1.txt", 'a') as f:
    f.write("\nAppended line 1")
    f.write("\nAppended line 2")

# Prepend to file1.txt
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file1.txt", 'r') as f:
    content = f.read()
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file1.txt", 'w') as f:
        f.write("Prepended line 1" + content)

# Replace content of file2.txt
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file2.txt", 'r') as f:
    content = f.read()
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file2.txt", 'w') as f:
        f.write("Replaced content: " + content)

# Commit changes
os.system("git add . && git commit -m '" + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "'")