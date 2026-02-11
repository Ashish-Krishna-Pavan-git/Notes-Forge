"""
Themes.py - Theme Management for NotesForge
Allows adding, editing, and switching themes
"""

import json
import os

class ThemeManager:
    """Manages all themes - can add/edit/delete themes"""
    
    def __init__(self):
        self.themes_file = "themes.json"
        self.themes = self.load_themes()
    
    def load_themes(self):
        """Load themes from file or create default themes"""
        if os.path.exists(self.themes_file):
            try:
                with open(self.themes_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        
        # Default themes
        return {
            "professional": {
                "name": "Professional",
                "description": "Classic professional look with orange accents",
                "fonts": {
                    "family": "Times New Roman",
                    "family_code": "Courier New",
                    "sizes": {
                        "day_heading": 18,
                        "day_heading_with_title": 16,
                        "topic_heading": 14,
                        "section_heading": 13,
                        "body": 12,
                        "code": 10
                    }
                },
                "colors": {
                    "day_heading": "#FF8C00",
                    "topic_heading": "#1F4788",
                    "section_heading": "#2E5C8A",
                    "code_background": "#F5F5F5"
                },
                "spacing": {
                    "line_spacing": 1.5,
                    "paragraph_spacing_after": 6,
                    "heading_spacing_before": 12,
                    "heading_spacing_after": 6
                },
                "page": {
                    "border": {"enabled": True, "width": 12}
                }
            },
            
            "academic": {
                "name": "Academic",
                "description": "Double-spaced academic paper style",
                "fonts": {
                    "family": "Times New Roman",
                    "family_code": "Courier New",
                    "sizes": {
                        "day_heading": 14,
                        "day_heading_with_title": 14,
                        "topic_heading": 13,
                        "section_heading": 12,
                        "body": 12,
                        "code": 10
                    }
                },
                "colors": {
                    "day_heading": "#000000",
                    "topic_heading": "#000000",
                    "section_heading": "#000000",
                    "code_background": "#F5F5F5"
                },
                "spacing": {
                    "line_spacing": 2.0,
                    "paragraph_spacing_after": 0,
                    "heading_spacing_before": 12,
                    "heading_spacing_after": 6
                },
                "page": {
                    "border": {"enabled": False, "width": 0}
                }
            },
            
            "modern": {
                "name": "Modern",
                "description": "Clean modern design with Calibri",
                "fonts": {
                    "family": "Calibri",
                    "family_code": "Consolas",
                    "sizes": {
                        "day_heading": 20,
                        "day_heading_with_title": 18,
                        "topic_heading": 15,
                        "section_heading": 13,
                        "body": 11,
                        "code": 10
                    }
                },
                "colors": {
                    "day_heading": "#4F46E5",
                    "topic_heading": "#7C3AED",
                    "section_heading": "#2563EB",
                    "code_background": "#F3F4F6"
                },
                "spacing": {
                    "line_spacing": 1.5,
                    "paragraph_spacing_after": 8,
                    "heading_spacing_before": 14,
                    "heading_spacing_after": 7
                },
                "page": {
                    "border": {"enabled": True, "width": 8}
                }
            },
            
            "minimal": {
                "name": "Minimal",
                "description": "Simple black and white, no borders",
                "fonts": {
                    "family": "Arial",
                    "family_code": "Courier New",
                    "sizes": {
                        "day_heading": 16,
                        "day_heading_with_title": 14,
                        "topic_heading": 13,
                        "section_heading": 12,
                        "body": 11,
                        "code": 9
                    }
                },
                "colors": {
                    "day_heading": "#000000",
                    "topic_heading": "#000000",
                    "section_heading": "#000000",
                    "code_background": "#F5F5F5"
                },
                "spacing": {
                    "line_spacing": 1.3,
                    "paragraph_spacing_after": 4,
                    "heading_spacing_before": 10,
                    "heading_spacing_after": 5
                },
                "page": {
                    "border": {"enabled": False, "width": 0}
                }
            },
            
            "book": {
                "name": "Book",
                "description": "Book-style formatting with serif fonts",
                "fonts": {
                    "family": "Georgia",
                    "family_code": "Courier New",
                    "sizes": {
                        "day_heading": 18,
                        "day_heading_with_title": 16,
                        "topic_heading": 14,
                        "section_heading": 13,
                        "body": 12,
                        "code": 10
                    }
                },
                "colors": {
                    "day_heading": "#2C3E50",
                    "topic_heading": "#34495E",
                    "section_heading": "#7F8C8D",
                    "code_background": "#ECF0F1"
                },
                "spacing": {
                    "line_spacing": 1.6,
                    "paragraph_spacing_after": 8,
                    "heading_spacing_before": 14,
                    "heading_spacing_after": 8
                },
                "page": {
                    "border": {"enabled": False, "width": 0}
                }
            },
            
            "colorful": {
                "name": "Colorful",
                "description": "Vibrant colors for presentations",
                "fonts": {
                    "family": "Verdana",
                    "family_code": "Consolas",
                    "sizes": {
                        "day_heading": 22,
                        "day_heading_with_title": 20,
                        "topic_heading": 16,
                        "section_heading": 14,
                        "body": 13,
                        "code": 11
                    }
                },
                "colors": {
                    "day_heading": "#DC2626",
                    "topic_heading": "#2563EB",
                    "section_heading": "#059669",
                    "code_background": "#FEF3C7"
                },
                "spacing": {
                    "line_spacing": 1.7,
                    "paragraph_spacing_after": 10,
                    "heading_spacing_before": 16,
                    "heading_spacing_after": 8
                },
                "page": {
                    "border": {"enabled": True, "width": 16}
                }
            }
        }
    
    def save_themes(self):
        """Save themes to file"""
        try:
            with open(self.themes_file, 'w') as f:
                json.dump(self.themes, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving themes: {e}")
            return False
    
    def get_theme(self, theme_name):
        """Get a specific theme"""
        return self.themes.get(theme_name, self.themes.get("professional"))
    
    def add_theme(self, name, theme_data):
        """Add or update a theme"""
        self.themes[name.lower().replace(" ", "_")] = theme_data
        return self.save_themes()
    
    def delete_theme(self, name):
        """Delete a theme (except professional)"""
        if name != "professional" and name in self.themes:
            del self.themes[name]
            return self.save_themes()
        return False
    
    def get_all_themes(self):
        """Get all theme names and descriptions"""
        return {
            name: {
                "name": data.get("name", name.title()),
                "description": data.get("description", "")
            }
            for name, data in self.themes.items()
        }
    
    def apply_theme_to_config(self, theme_name, config):
        """Apply a theme to config object"""
        theme = self.get_theme(theme_name)
        
        # Update config with theme values
        if "fonts" in theme:
            config["fonts"].update(theme["fonts"])
        if "colors" in theme:
            config["colors"].update(theme["colors"])
        if "spacing" in theme:
            config["spacing"].update(theme["spacing"])
        if "page" in theme:
            config["page"].update(theme["page"])
        
        return config


# Create default themes file on first import
if __name__ == "__main__":
    tm = ThemeManager()
    tm.save_themes()
    print("✅ Default themes created!")
