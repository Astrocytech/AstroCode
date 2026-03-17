# -*- coding: utf-8 -*-

def convert_to_uppercase(file_path):
    with open(file_path, 'r') as data:
        content = data.read()
        return content.upper()

def main():
    file_path = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/data.txt'
    converted_content = convert_to_uppercase(file_path)
    with open(file_path, 'w') as data:
        data.write(converted_content)

if __name__ == "__main__":
    main()
