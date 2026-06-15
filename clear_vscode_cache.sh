#!/bin/bash

echo "Clearing VS Code-based IDE caches..."

# Clear Antigravity cache
if [ -d "$HOME/.config/Antigravity" ]; then
    echo "Clearing Antigravity cache..."
    rm -rf "$HOME/.config/Antigravity/Cache"
    rm -rf "$HOME/.config/Antigravity/CachedData"
    rm -rf "$HOME/.config/Antigravity/GPUCache"
    rm -rf "$HOME/.config/Antigravity/Service Worker"
    echo " Antigravity cache cleared"
fi

# Clear VS Code Insiders cache
if [ -d "$HOME/.config/Code - Insiders" ]; then
    echo "Clearing VS Code Insiders cache..."
    rm -rf "$HOME/.config/Code - Insiders/Cache"
    rm -rf "$HOME/.config/Code - Insiders/CachedData"
    rm -rf "$HOME/.config/Code - Insiders/GPUCache"
    rm -rf "$HOME/.config/Code - Insiders/Service Worker"
    echo " VS Code Insiders cache cleared"
fi

# Clear regular VS Code cache (just in case)
if [ -d "$HOME/.config/Code" ]; then
    echo "Clearing VS Code cache..."
    rm -rf "$HOME/.config/Code/Cache"
    rm -rf "$HOME/.config/Code/CachedData"
    rm -rf "$HOME/.config/Code/GPUCache"
    rm -rf "$HOME/.config/Code/Service Worker"
    echo " VS Code cache cleared"
fi

echo ""
echo "All caches cleared! Please restart your IDE and try again."
