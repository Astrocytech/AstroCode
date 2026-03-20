#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directory if not exists
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Define files and content
req_file = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/requirements.txt"
procfile = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/Procfile"

with open(req_file, 'a') as f:
    f.write("gunicorn app:app\n")

with open(procfile, 'w') as f:
    f.write("web: gunicorn app:app --log-file -\n")

os.system("git add . && git commit -m 'Update' && git push heroku main")