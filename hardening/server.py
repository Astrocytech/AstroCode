
import http.server

PORT = 8000
server_address = ('', PORT)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

print(f"Server running on port {PORT}")
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("
Server shutting down.")
    httpd.socket.close()
