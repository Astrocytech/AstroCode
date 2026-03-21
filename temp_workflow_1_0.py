#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directories if needed
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Initialize git repo in new directory
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/.gitattributes", 'w') as f:
    f.write("")

os.system('git init')
os.system('git config --global user.name "Your Name"')
os.system('git config --global user.email "your_email@example.com"')

# Create .gitignore file instead of appending to it
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/.gitignore", 'w') as f:
    f.write("# Ignore everything in .idea directory\n.idea/\n")

os.system('git add .')
os.system('git commit -m "Initial commit"')