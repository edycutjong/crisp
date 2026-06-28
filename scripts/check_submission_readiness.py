#!/usr/bin/env python3
import os
import sys

SEARCH_DIR = "."
EXCLUDE_DIRS = [".next", "node_modules", ".git", ".github", "docs/assets", "docs", "coverage", ".lighthouseci", ".vercel", "test-results"]
EXCLUDE_FILES = ["check_submission_readiness.py"]
FORBIDDEN_KEYWORDS = ["TODO", "FIXME", "PLACEHOLDER", "lorem", "example.com", "localhost:3000"]

def scan_files():
    print("==========================================================")
    print("      CRISP HACKATHON SUBMISSION READINESS CHECKER        ")
    print("==========================================================")
    print("Scanning codebase for placeholders, localhost bindings, and test stubs...")
    print("")

    failures = 0
    scanned_count = 0

    for root, dirs, files in os.walk(SEARCH_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            if file in EXCLUDE_FILES:
                continue
            
            if not file.endswith(('.ts', '.tsx', '.js', '.json', '.md', '.sql', '.rs', '.circom')):
                continue

            filepath = os.path.join(root, file)
            scanned_count += 1
            
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        for kw in FORBIDDEN_KEYWORDS:
                            if kw in line and not line.strip().startswith("//") and not line.strip().startswith("#"):
                                if kw == "localhost:3000" and ("README.md" in file or "playwright.config.ts" in file or "lighthouserc.json" in file or "test" in file or file.endswith(".md")):
                                    continue
                                
                                print(f"⚠️  FOUND '{kw}' in {filepath}:{line_num}")
                                print(f"    Line: {line.strip()}")
                                failures += 1
            except Exception as e:
                print(f"Error reading {filepath}: {e}")

    print("")
    print(f"Scan complete. Checked {scanned_count} files.")
    if failures > 0:
        print(f"❌ FAILED: Found {failures} unresolved placeholder(s) or localhost references.")
        sys.exit(1)
    else:
        print("✅ SUCCESS: Codebase is clean and ready for submission!")
        sys.exit(0)

if __name__ == "__main__":
    scan_files()
