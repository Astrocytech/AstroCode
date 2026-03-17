def counter():
    count = 0

    def inner(x):
        nonlocal count
        count += x
        return count

    return inner
