#!/bin/bash

# Create backup of current directory
mkdir /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/backups
tar -czf hardening/backups/current_backup.tar.gz .

# Create backup of specific file
cp filename.txt hardening/backups/
