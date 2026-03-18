def safe_divide(a, b):
    try:
        result = a / b
        return result
    except ZeroDivisionError:
        with open('/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/division_by_zero.txt', 'a') as f:
            f.write('Attempted division by zero: {} divided by {}
'.format(a, b))
        return 'Error: Division by zero'
