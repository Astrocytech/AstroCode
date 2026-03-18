#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os
import subprocess

# Create directory if not exists
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Initialize git repo in new directory
subprocess.run(["git", "add", "."])
subprocess.run(["git", "commit", "-m", "Initial commit"])