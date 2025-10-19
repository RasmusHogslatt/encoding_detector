# VS Code Encoding Detector

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

This extension automatically detects file encodings using Python's `chardet` library and displays a prominent warning in the status bar for any file not encoded in a "safe" format (like ASCII or UTF-8). It helps prevent accidental character corruption when working in codebases with mixed or legacy encodings.

## Features

- 🚦 **Status Bar Indicator**: Instantly see a file's detected encoding in the bottom-right corner of VS Code.
- ⚠️ **Configurable Warnings**: Get a visual warning (orange background) for any encoding not in your configured "safe list".
- 🔍 **Automatic Detection**: When you open a file or switch tabs, the encoding is detected automatically.
- ⚙️ **Customizable**: You can easily add encodings (e.g., `iso-8859-1`) to your safe list via VS Code settings.

## Prerequisites

You must have **Python 3** and the `chardet` library installed and available in your system's PATH.

```bash
# Install chardet using pip for Python 3
pip3 install chardet
