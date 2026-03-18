
def fibonacci(n, memo={}):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    elif n not in memo:
        memo[n] = fibonacci(n-1, memo) + fibonacci(n-2, memo)
    return memo[n]

with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/fibonacci.txt", 'w') as f:
    for i in range(10):
        f.write(str(fibonacci(i)) + "
")
