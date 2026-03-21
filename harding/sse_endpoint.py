
from flask import Flask, request
app = Flask(__name__)

@app.route('/sse', methods=['GET'])
def sse():
    return ''

if __name__ == "__main__":
    app.run(debug=True)

NEW CONTENT