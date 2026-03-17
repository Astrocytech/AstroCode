import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', help='Your name')
    args = parser.parse_args()
    with open("/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/cli.log", 'w') as log:
        log.write(f"Hello {args.name}!")

if __name__ == "__main__":
    main()
