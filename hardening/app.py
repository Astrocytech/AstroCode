from bottle import run, route

@route('/')
def index():
    return "Hello World!"

run(host='localhost', port=8080)