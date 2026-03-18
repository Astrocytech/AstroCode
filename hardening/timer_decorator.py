from functools import wraps

def timer_decorator(func):
    @wraps(func)
    def wrapper_timer(*args, **kwargs):
        start_time = time.time()
        value = func(*args, **kwargs)
        end_time = time.time()
        execution_time = end_time - start_time
        return value, execution_time
    return wrapper_timer