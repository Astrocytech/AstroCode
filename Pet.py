New text

class Pet:
    def __init__(self):
        pass
class Cat(Pet):
    def __init__(self, name, age, color):
        super().__init__()
        self.name = name
        self.age = age
        self.color = color

class Pet:
    pass