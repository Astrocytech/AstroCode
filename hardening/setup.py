from setuptools import setup, find_packages

setup(
  name="AstroPackage",
  version=__import__("__init__").__version__,
  packages=find_packages(),
)
