#!/bin/bash
# Setup script for blockchain log analyzer

echo "Setting up Python environment for blockchain log analyzer..."

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed"
    exit 1
fi

# Check if pip3 is available
if ! command -v pip3 &> /dev/null; then
    echo "Error: pip3 is not installed"
    exit 1
fi

# Install dependencies
echo "Installing Python dependencies..."
pip3 install --user -r requirements.txt

if [ $? -eq 0 ]; then
    echo "Setup completed successfully!"
    echo "You can now run the script using VS Code or directly with:"
    echo "  python3 scripts/plot_blockchain_logs.py"
else
    echo "Setup failed. Please check your Python installation."
    exit 1
fi
