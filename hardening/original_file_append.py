try:
print(1/0)
except Exception as e:
    print(f'An error occurred: {str(e)}')