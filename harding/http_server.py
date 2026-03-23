import http.server
from http.server import BaseHTTPRequestHandler
server = http.server.HTTPServer(('', 8000), RequestHandler)
server.serve_forever()