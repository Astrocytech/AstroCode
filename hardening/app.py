from flask import Flask, request
app = Flask(__name__)

@app.route('/your_route', methods=['GET'])
def your_function():
    token = request.headers.get('Authorization')
    if not check_jwt_token(token):
        return "Invalid token"
    # rest of your code
    pass