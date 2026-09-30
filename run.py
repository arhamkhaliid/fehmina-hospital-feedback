#!/usr/bin/env python3
import sys
import os

# Ensure the root folder is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.server import run_server

if __name__ == '__main__':
    run_server()
