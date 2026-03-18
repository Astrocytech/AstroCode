import numpy as np
data = np.array([0, 2])

def prepend_function():
    data[0] = 1
prepend_function()
print(data)
