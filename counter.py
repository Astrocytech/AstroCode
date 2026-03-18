
def counter():
    count = 0

    def inner():
        nonlocal count
        count += 1
        return count - 1

    return inner

count_func = counter()
with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/counter_result.txt", 'w') as f:
    for _ in range(10):
        result = count_func()
        f.write(f"Counter call {result + 1}
")
