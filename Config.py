"""
Config.py - Configuration Manager for NotesForge
Loads, saves, and manages all settings
"""

import json
import os

class ConfigManager:
    """Manages configuration - loads/saves settings"""
    
    def __init__(self, config_file="Config.json"):
        self.config_file = config_file
        self.config = self.load_config()
    
    def load_config(self):
        """Load configuration from file"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading config: {e}")
        
        # Return default config if file doesn't exist
        return self.get_default_config()
    
    def get_default_config(self):
        """Return default configuration"""
        return {
            "app": {
                "name": "NotesForge Ultimate by AKP",
                "version": "1.0.0",
                "theme": "professional"
            },
            "fonts": {
                "family": "Times New Roman",
                "family_code": "Courier New",
                "sizes": {
                    "day_heading": 18,
                    "day_heading_with_title": 16,
                    "topic_heading": 14,
                    "section_heading": 13,
                    "body": 12,
                    "code": 10,
                    "label": 12,
                    "quote": 12,
                    "formula": 12
                }
            },
            "colors": {
                "day_heading": "#FF8C00",
                "topic_heading": "#1F4788",
                "section_heading": "#2E5C8A",
                "code_background": "#F5F5F5",
                "table_header_bg": "#4A7BA7",
                "table_header_text": "#FFFFFF",
                "table_odd_row": "#F5F5F5",
                "table_even_row": "#FFFFFF"
            },
            "spacing": {
                "line_spacing": 1.5,
                "paragraph_spacing_after": 6,
                "heading_spacing_before": 12,
                "heading_spacing_after": 6,
                "code_indent": 0.25,
                "quote_indent": 0.5
            },
            "page": {
                "margins": {
                    "top": 1.0,
                    "bottom": 1.0,
                    "left": 1.0,
                    "right": 1.0
                },
                "border": {
                    "enabled": True,
                    "width": 12,
                    "space": 24
                }
            },
            "header": {
                "enabled": True,
                "text": "NotesForge Ultimate by AKP",
                "size": 11,
                "color": "#FF8C00",
                "bold": True
            },
            "footer": {
                "enabled": True,
                "show_page_numbers": True,
                "size": 10
            },
            "commands": [
                "ls", "cd", "pwd", "mkdir", "rm", "cp", "mv", "touch", "cat", "chmod",
                "chown", "grep", "sed", "awk", "find", "git", "npm", "pip", "python",
                "node", "curl", "wget", "ssh", "docker", "kubectl", "make", "gcc",
                "java", "mysql", "psql", "mongo", "redis", "nginx", "systemctl",
                "service", "ps", "top", "kill", "df", "du", "free", "netstat",
                "ifconfig", "ping", "traceroute", "tar", "gzip", "zip", "unzip"
            ],
            "output": {
                "default_format": "docx",
                "enable_pdf": True
            }
        }
    
    def save_config(self):
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def get(self, key, default=None):
        """Get a config value using dot notation (e.g., 'fonts.family')"""
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
        
        return value if value is not None else default
    
    def set(self, key, value):
        """Set a config value using dot notation"""
        keys = key.split('.')
        config = self.config
        
        # Navigate to the nested dict
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        # Set the value
        config[keys[-1]] = value
        return self.save_config()
    
    def add_command(self, command):
        """Add a command to the commands list"""
        if command not in self.config["commands"]:
            self.config["commands"].append(command)
            return self.save_config()
        return False
    
    def remove_command(self, command):
        """Remove a command from the commands list"""
        if command in self.config["commands"]:
            self.config["commands"].remove(command)
            return self.save_config()
        return False
    
    def get_commands(self):
        """Get all commands"""
        return self.config.get("commands", [])
    
    def hex_to_rgb(self, hex_color):
        """Convert hex color to RGB tuple"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def update_from_theme(self, theme_config):
        """Update config with theme settings"""
        if "fonts" in theme_config:
            self.config["fonts"].update(theme_config["fonts"])
        if "colors" in theme_config:
            self.config["colors"].update(theme_config["colors"])
        if "spacing" in theme_config:
            self.config["spacing"].update(theme_config["spacing"])
        if "page" in theme_config:
            self.config["page"].update(theme_config["page"])
        
        return self.save_config()


# Create default config file if it doesn't exist
if __name__ == "__main__":
    cm = ConfigManager()
    cm.save_config()
    print("✅ Default config created!")
