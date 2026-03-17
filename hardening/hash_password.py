
import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

# Example usage
password = "mysecretpassword"
hashed_password = hash_password(password)
print(hashed_password)
