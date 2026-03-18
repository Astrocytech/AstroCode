# Name: 
# Age: 
import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--name', help='Name of the person')
parser.add_argument('--age', help='Age of the person')
parser.add_argument('--verbose', action='store_true')
