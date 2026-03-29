"""Minimal worker placeholder.

Future flow:
1) pick queued jobs from backend/db
2) transcribe audio
3) summarize + extract topics
4) write results back
"""

import time


def main():
    print('Worker started (placeholder).')
    while True:
        time.sleep(5)
        print('Polling for jobs...')


if __name__ == '__main__':
    main()
