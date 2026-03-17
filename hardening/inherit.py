
class Pet:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print("Generic animal sound")

class Cat(Pet):
    def speak(self):
        return "Meow"
