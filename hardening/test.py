from auth import jwt_authentication
token = "your_jwt_token_here"
payload = jwt_authentication(token)
print(payload)if __name__ == '__main__':
    from auth import jwt_authentication
    token = "your_jwt_token_here"
    payload = jwt_authentication(token)
    print(payload)