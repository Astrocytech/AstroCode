#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directories if needed
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Checkout branch feature/new using git commands
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/git_commands.txt", 'w') as f:
    f.write("git checkout -b feature/new\n")

# Append the new file to the repository
os.system("git add .")
os.system("git commit -m 'Initial commit'")
os.system("git branch -M feature/new")
os.system("git checkout feature/new")