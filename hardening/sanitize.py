import sqlite3
import re

def sanitize_input(input_string):
    if input_string is None:
        return "NULL"

    # Remove comments
    input_string = re.sub(r';.*$', '', input_string)
    input_string = re.sub(r'--.*$', '', input_string)

    # Remove SQL keywords
    sql_keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT']
    for keyword in sql_keywords:
        input_string = re.sub(r'%s'.replace('%', r'\%'), '', input_string, flags=re.IGNORECASE)

    return input_string

# Example usage:
if __name__ == "__main__":
    user_input = "Robert'); DROP TABLE users; --"
    sanitized_input = sanitize_input(user_input)
    print(sanitized_input)
