
import requests

def stress_test():
    for _ in range(100):
        response = requests.get("https://example.com/api")
        print(response.status_code)

stress_test()
