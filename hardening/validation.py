from fastapi import Depends, HTTPException
import jwt

def get_token():
    token = "your_secret_token"
    return token

async def authenticate_token(token: str):
    try:
        payload = jwt.decode(token, key="your_secret_key", algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(token: str):
    user = authenticate_token(token)
    return user

# Add JWT validation to routes
from fastapi import Depends

@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user
