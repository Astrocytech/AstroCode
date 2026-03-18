from fastapi import FastAPI, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
app = FastAPI()
auth_scheme = HTTPBearer()
def jwt_authentication(token: str):
    try:
        payload = jwt.decode(token, secret_key="your_secret_key_here", algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token has expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')
@app.post("/protected")
async def protected_endpoint(token: str = Security(auth_scheme, scopes=['']),)
    payload = jwt_authentication(token)
    return {"message": "Hello World!"}
