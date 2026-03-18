#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os
from datetime import date

os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file1.txt", 'w') as f:
    f.write("This is file 1.")

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file2.txt", 'w') as f:
    f.write("This is file 2.")

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file3.txt", 'w') as f:
    f.write("This is file 3.")

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file4.txt", 'a') as f:
    f.write("New line added to file 4.\n")

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file5.txt", 'w') as f:
    f.write("This is a new file, prepending previous contents:\n")
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/file6.txt", 'r') as rf:
        f.write(rf.read())

os.system('git add .')
os.system('git commit -m "Added files"')