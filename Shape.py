New text

from abc import ABCMeta

class Shape(metaclass=ABCMeta):
    @staticmethod
    def area(cls):
        raise NotImplementedError("Subclass must implement abstract method")