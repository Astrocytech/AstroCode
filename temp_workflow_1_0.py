#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directories if needed
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Open requirements.txt for writing
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/requirements.txt", 'w') as f:
    f.write("flask\n")

# Open Procfile for writing
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/Procfile", 'w') as f:
    f.write("web: gunicorn app:app")

# Create runtime.txt
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/runtime.txt", 'w') as f:
    f.write("python-3.9.7\n")

# Append to .gitignore if it exists, otherwise create a new file
try:
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/.gitignore", 'a') as f:
        f.write("\nrequirements.txt\nProcfile\nruntime.txt")
except FileNotFoundError:
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/.gitignore", 'w') as f:
        f.write("requirements.txt\nProcfile\nruntime.txt")

# Note: heroku login should be done manually or via an API key
# Deploy to Heroku
os.system('git init')
os.system('git add . && git commit -m "initial commit"')
os.system('heroku create')
os.system('git push heroku main')  # Changed 'master' to 'main'