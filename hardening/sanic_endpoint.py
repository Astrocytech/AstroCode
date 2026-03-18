
from sanic import Sanic

app = Sanic("MySanic")

@app.route("/")
async def test(request):
    return "Hello, world!"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
