#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os
import shutil

# Create directory if it does not exist
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Initialize a new git repository in the created directory
try:
    # Try to initialize the repo, but this will fail because .git dir already exists after init
    os.system("git add . && git commit -m 'Initial commit'")
except Exception as e:
    print(f"Error initializing git: {e}")

# Create a new file (if it does not exist) and write content to it
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/init.txt", 'w') as f:
    f.write("# Initialize hardening directory\n")

# Append content to the existing init.txt file (if it exists)
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/init.txt", 'a') as f:
    f.write("\n# Added by Python script\n")