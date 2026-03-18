class Temperature:
    def __init__(self):
        self.celsius = 0

@property
def celsius(self):
    return self._celsius

@celsius.setter
def celsius(self, value):
    self._celsius = value
    self.fahrenheit = (value * 9/5) + 32
    with open(f"/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/fahrenheit.txt", 'w') as f: f.write(str(self.fahrenheit))
