"""
App.py - Main Application Launcher for NotesForge
Run this file to start the application
"""

from Frontend import NotesForgeUI

def main():
    """Launch the NotesForge application"""
    app = NotesForgeUI()
    app.run()

if __name__ == "__main__":
    main()
