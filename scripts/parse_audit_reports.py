#!/usr/bin/env python3
"""
Parse agent output files and extract final reports
"""
import json
import sys

def extract_final_messages(filepath, last_n=20):
    """Extract last N assistant messages from JSONL file"""
    messages = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line.strip())
                    if data.get('type') == 'assistant' and 'message' in data:
                        msg = data['message']
                        if 'content' in msg:
                            for content in msg['content']:
                                if content.get('type') == 'text':
                                    messages.append(content['text'])
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        return []

    return messages[-last_n:]

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_audit_reports.py <filepath>")
        sys.exit(1)

    filepath = sys.argv[1]
    messages = extract_final_messages(filepath)

    print("=" * 80)
    print(f"Last {len(messages)} messages from: {filepath}")
    print("=" * 80)
    print()

    for i, msg in enumerate(messages, 1):
        print(f"--- Message {i} ---")
        print(msg)
        print()

if __name__ == '__main__':
    main()
