@timer_decorator
def my_function():
    time.sleep(2)
    return 1
value, execution_time = my_function()
print(f'Execution Time: {execution_time} seconds')