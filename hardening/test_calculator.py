import unittest

def add(a, b):
    return a + b

class TestAddFunction(unittest.TestCase):

    def test_add_two_positive_numbers(self):
        self.assertEqual(add(2, 3), 5)

    def test_add_two_negative_numbers(self):
        self.assertEqual(add(-2, -3), -5)

    def test_add_positive_and_negative_number(self):
        self.assertEqual(add(2, -3), -1)

if __name__ == '__main__':
    unittest.main()
