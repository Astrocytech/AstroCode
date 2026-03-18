
import asyncio
import websockets

async def send_message():
    async with websockets.connect("wss://echo.websocket.org") as websocket:
        message = {"type": "message", "text": "Hello, world!"}
        await websocket.send(json.dumps(message))
        response = await websocket.recv()
        print(response)

loop = asyncio.get_event_loop()
loop.run_until_complete(send_message())
