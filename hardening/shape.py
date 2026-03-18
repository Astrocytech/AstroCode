
import abc
class Shape(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def area(self):
        pass
