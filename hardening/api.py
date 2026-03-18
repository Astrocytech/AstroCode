
from flask import Flask, request
app = Flask(__name__)
@app.before_request
def rate_limit():
    if request.remote_addr in limit_req.get("rate"):
        return "Rate Limit Exceeded", 429
