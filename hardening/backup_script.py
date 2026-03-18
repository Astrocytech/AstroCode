#!/usr/bin/env python3

import os, shutil
import json

def create_backup():
    with open('/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/backup_config.json') as config_file:
        config = json.load(config_file)

    shutil.copy('filename.txt', config['backup_dir'])

if __name__ == '__main__':
    create_backup()
