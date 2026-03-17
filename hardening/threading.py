
import threading

def task1():
    print("Task 1 running")

def task2():
    print("Task 2 running")

def task3():
    print("Task 3 running")

t = threading.Thread(target=task1)
t.start()
t.join()

t = threading.Thread(target=task2)
t.start()
t.join()

t = threading.Thread(target=task3)
t.start()
t.join()
