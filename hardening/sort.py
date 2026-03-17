import numpy as np
from astropy.table import Table, Column

# Assuming numbers.txt is in the same directory
numbers = np.loadtxt('numbers.txt')
numbers.sort()
sorted_numbers = Table(numbers)
sorted_numbers.write('sorted_numbers.fits', overwrite=True)