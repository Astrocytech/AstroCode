
	if n <= 1:
		return n
	fib_value_2 = fibonacci(n-2)
	fib_value_1 = fibonacci(n-1)
	return fib_value_2 + fib_value_1
