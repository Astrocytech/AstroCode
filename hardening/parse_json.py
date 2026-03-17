
import json

def extract_name_fields(data):
    name_fields = [item['name'] for item in data]
    return name_fields

def main():
    with open('/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/data.json', 'r') as f:
        data = json.load(f)
    
    name_fields = extract_name_fields(data)
    print(name_fields)

if __name__ == "__main__":
    main()
