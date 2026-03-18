import asyncio
async def receive_message():
    async with websockets.connect('wss://echo.websocket.org') as websocket:
        print(await websocket.recv())
