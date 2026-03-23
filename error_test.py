New text

def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        print("Error: Division by zero is not allowed.")
print(divide(10, 0))
