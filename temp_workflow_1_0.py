#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/njonji/Desktop/IZBR')
import os
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)
import os
from pathlib import Path

# Create directories if needed
os.makedirs("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening", exist_ok=True)

# Define files and their contents
requirements = """
flask
gunicorn
"""
Procfile = """
web: gunicorn app:app
"""

# Write the requirements file
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/requirements.txt", 'w') as f:
    f.write(requirements)

# Write the Procfile
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/Procfile", 'w') as f:
    f.write(Procfile)

# Edit runtime.txt (append)
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/runtime.txt", 'a') as f:
    f.write("python-3.9.5")

# Edit runtime.txt (prepend)
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/runtime.txt", 'r+') as f:
    contents = f.read()
    new_contents = "python-3.9.5\n" + contents
    f.seek(0)
    f.write(new_contents)
    f.truncate()

# Edit the app.py file to include a main guard
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/app.py", 'r+') as f:
    contents = f.read()
    new_contents = "if __name__ == '__main__':\n\tapp.run(debug=True)\n" + contents
    f.seek(0)
    f.write(new_contents)
    f.truncate()

# Commit and push changes to Heroku
os.system("git add .")
os.system("git commit -m 'Deploy app to Heroku'")
os.system("heroku create")
os.system('heroku git remote add heroku https://git.heroku.com/your-app-name.git') # Added quotes around the URL
os.system('heroku deploy')