#!/usr/bin/python3
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('-n', '--name', help='Name')
    parser.add_argument('-v', '--verbose', action='store_true')
    parser.add_argument('-o', '--output', help='Output')

    args = parser.parse_args()
    if args.verbose:
        print('Verbose mode activated')
