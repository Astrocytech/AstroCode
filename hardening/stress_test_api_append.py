
import requests

def stress_test():
    for _ in range(50):
        response = requests.get("https://example.com/api")
        print(response.status_code)

stress_test()
