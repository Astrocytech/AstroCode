
def counter_gen():
    n = 0
    while True:
        yield n
        n += 1

counter = counter_gen()
for _ in range(10):
    print(next(counter))
