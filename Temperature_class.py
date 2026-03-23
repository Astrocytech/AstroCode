New text

class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius
    @property
    def fahrenheit(self):
        return (self.celsius * 9/5) + 32
    @fahrenheit.setter
    def fahrenheit(self, value):
        if isinstance(value, (int, float)):
            self.celsius = (value - 32) * 5 / 9
        else:
            raise ValueError('Invalid temperature value')