
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    @celsius.setter
    def celsius(self, value):
        self.fahrenheit = (value * 9/5) + 32
