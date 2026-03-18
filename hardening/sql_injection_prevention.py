
def safe_query(query, *args):
    sanitized_args = [str(arg).replace("'", "''").replace('"', '""') for arg in args]
    return query.replace("?", "%s").format(*sanitized_args)

def sanitize_input(input_str):
    return input_str.replace("'", "''").replace('"', '""')
