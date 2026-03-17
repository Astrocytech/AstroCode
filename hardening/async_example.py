
import asyncio

async def main():
    print("Hello, world!")
    await asyncio.sleep(1)
    print("Async function finished")

if __name__ == "__main__":
    asyncio.run(main())
