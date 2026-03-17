# csv_processor.py
import csv

def calculate_average(file_path):
    with open(file_path, 'r') as file:
        reader = csv.reader(file)
        values = [float(row[0]) for row in reader]
        return sum(values) / len(values)

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/example.csv", 'w') as f:
    f.write("value
")
    f.write("1
")
    f.write("2
")
    f.write("3
")

print(calculate_average("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/example.csv"))
