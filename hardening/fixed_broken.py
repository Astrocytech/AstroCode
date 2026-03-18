
def add(x, y):
    return x + y

def subtract(x, y):
    if isinstance(y, (int, float)):
        return x - y
    else:
        raise TypeError('Right operand must be int or float')
