
# Security best practices:

# 1. Use parameterized queries instead of string formatting
query = "SELECT * FROM users WHERE name=%s AND email=%s"
data = ("John Doe", "john@example.com")
cursor.execute(query, data)

# 2. Escape user input when using string formatting
query = "SELECT * FROM users WHERE name='%s' AND email='%s'"
user_input = sanitize_input(input_str)
query = query.replace("%s", "'" + user_input + "'")

# 3. Use a whitelist of allowed characters for user input
allowed_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._@-")
user_input = "".join(c for c in input_str if c in allowed_chars)

