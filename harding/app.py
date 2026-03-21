from flask import Flask
app = Flask(__name__)

from flask import Flask, Response

app = Flask(__name__)

@app.route('/sse', methods=['GET'])
def sse():
    def event_stream():
        while True:
            yield "event: message
data: {}

".format(sse_event.source())
            
    return Response(event_stream(), mimetype='text/event-stream')

NEW CONTENT