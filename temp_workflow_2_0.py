#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directories if needed
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Stash changes
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/stashed_changes.txt", 'w') as f:
    os.system('git add .')
    os.system('git stash save "Stashing changes..."')

# Pop stash
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/popped_stash.txt", 'w') as f:
    os.system('git stash pop')