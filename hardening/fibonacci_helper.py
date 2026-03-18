def fib_helper(n):
    return fib(n)

def helper(n):
    if n == 0 or n == 1:
        return n
    else:
        return helper(n-1) + helper(n-2)

def fib(n):
    return helper(n)
