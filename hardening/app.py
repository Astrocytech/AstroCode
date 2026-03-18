from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return 'Home Page'

@app.route('/api/data')
def data():
    data = {'key': 'value'}
    return jsonify(data)

if __name__ == "__main__":
    app.run(debug=True)