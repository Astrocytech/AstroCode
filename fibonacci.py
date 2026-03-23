New text

def fibonacci(n):
    if n <= 0:
        return "Input should be positive integer"
    elif n == 1 or n == 2:
        return 1
    else:
        with open('/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/fibonacci.py', 'r') as file:
            content = file.read()
            lines = content.split('\n')
            fib_prev, fib_curr = 1, 1
            for line in lines[:-3]:
                if 'fib_prev' in line and 'fib_curr' in line:
                    exec(line)
                else:
                    fib_prev, fib_curr = fib_curr, eval(line.split('=')[1])
            result = fib_prev
        return result
