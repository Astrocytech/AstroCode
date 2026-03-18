#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os

# Create directory
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Deploy app to Heroku

# File paths
requirements_file_path = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/requirements.txt"
procfile_path = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/Procfile"

# Writing requirements file
with open(requirements_file_path, 'w') as f:
    f.write("your-package-name==version\n")

# Writing Procfile
with open(procfile_path, 'w') as f:
    f.write("web: gunicorn your-app-name:wsgi")

# Commit and push changes to GitHub repository
os.system("git add . && git commit -m 'Deploying app to Heroku' && git push origin master")

# Create a new release on Heroku using the heroku CLI
os.system("heroku create && heroku apps:edit --set buildpack=https://github.com/heroku/heroku-buildpack-python.git")

# Link the new Heroku app with the existing GitHub repository
os.system("heroku git:remote -a your-app-name")