
import pandas as pd
from pathlib import Path

def filter_rows(file_path, condition):
    data = pd.read_csv(file_path)
    filtered_data = data[data[condition]]
    return filtered_data

if __name__ == "__main__":
    file_path = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/data.csv"
    column_name = "column_to_filter"  # replace with actual column name
    condition = f"{column_name} > 10"
    filtered_data = filter_rows(file_path, condition)
    filtered_data.to_csv(f"filtered_{Path(file_path).stem}.csv", index=False)
