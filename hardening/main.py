from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Add JWT validation to routes
from gateway import app
