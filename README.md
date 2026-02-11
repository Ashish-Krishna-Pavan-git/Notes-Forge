# 📚 NotesForge Ultimate

<div align="center">

![NotesForge Banner](https://img.shields.io/badge/NotesForge-Ultimate-FF8C00?style=for-the-badge&logo=bookstack&logoColor=white)
![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.8+-green?style=for-the-badge&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-1.28+-red?style=for-the-badge&logo=streamlit&logoColor=white)
![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey?style=for-the-badge)

**Turn raw, messy AI-formatted notes into beautiful, professional Word documents — in seconds.**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Themes](#-themes) • [Configuration](#-configuration) • [Prompt Guide](#-ai-prompt-guide) • [License](#-license)

</div>

---

## ✨ What is NotesForge?

NotesForge is a **Streamlit-powered desktop/web app** that takes structured plain-text notes (formatted by AI tools like ChatGPT or Claude) and converts them into polished, professionally styled **DOCX** or **PDF** documents — with smart auto-detection of headings, bullet points, code blocks, tables, math expressions, and more.

> 💡 Built for students, developers, and professionals who take a lot of notes and want them to look great without manual formatting.

---

## 🚀 Features

| Feature | Description |
|--------|-------------|
| 🧠 **Smart Text Detection** | Auto-classifies Day headings, Topic headings, bullets, code, tables, labels, formulas |
| 📄 **DOCX & PDF Export** | Export to Word document or PDF with a single click |
| 🎨 **6 Built-in Themes** | Professional, Academic, Modern, Minimal, Book, Colorful |
| ⚙️ **Full Customization** | Fonts, colors, spacing, page borders, headers, footers — all configurable |
| 💻 **Code Block Support** | Syntax-aware code formatting with monospace font and background |
| 📊 **Table Detection** | Automatically detects and formats space-separated tables |
| 🧮 **Math Expression Support** | Handles mathematical symbols (×, ÷, ², ³, subscripts) |
| 🏷️ **Smart Labels** | Auto-bolds `Example:`, `Steps:`, `Note:`, `Solution:`, `Commands:`, `Output:` |
| 🖥️ **Live Preview** | See formatted output before downloading |
| 🔧 **Config Editor** | Edit all settings directly from the UI |
| 📝 **Custom Commands List** | Add your own shell commands for auto-detection |

---

## 📦 Installation

### Prerequisites
- Python 3.8 or higher
- pip

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/notesforge.git
cd notesforge

# 2. (Optional but recommended) Create a virtual environment
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the app
streamlit run App.py
```

The app will open in your browser at `http://localhost:8501`

---

## 🗂️ Project Structure

```
notesforge/
│
├── App.py              # Entry point — run this to launch the app
├── Frontend.py         # Streamlit UI — all pages and components
├── Core.py             # Text analysis & document building engine
├── Config.py           # Configuration manager (load/save/update)
├── Themes.py           # Theme manager (load/apply/create themes)
│
├── Config.json         # Main configuration file (edit to customize)
├── themes.json         # All theme definitions
├── prompt.txt          # AI prompt to paste into ChatGPT/Claude
│
└── requirements.txt    # Python dependencies
```

---

## 🧑‍💻 Usage

### Step 1 — Format your notes using AI

Copy the prompt from `prompt.txt` and paste it into **ChatGPT or Claude**, then provide your raw notes or images.

The AI will return text formatted like this:

```
Day 15 - 

Day 15 - Binary Number System

1. Topic: Introduction to Binary
- Binary uses only 0 and 1
- Base-2 number system

Example:
- Binary 1011 = 11 in decimal

Steps:
- Identify bit position
- Calculate power of 2
- Multiply and sum

Commands:
$ python converter.py
```

### Step 2 — Paste into NotesForge

Paste the formatted text into the input area in the app.

### Step 3 — Choose theme & export

Select a theme, preview the output, and download your `.docx` or `.pdf` file.

---

## 🎨 Themes

| Theme | Style | Best For |
|-------|-------|----------|
| **Professional** | Orange accents, Times New Roman, bordered | General use, corporate |
| **Academic** | Double-spaced, black text, no border | Essays, reports |
| **Modern** | Calibri, purple/blue accents | Tech notes, presentations |
| **Minimal** | Arial, black & white, compact | Quick references |
| **Book** | Georgia serif, dark headings | Long-form notes |
| **Colorful** | Verdana, vibrant colors | Visual learners |

> You can also **create your own theme** directly from the Themes tab in the app.

---

## ⚙️ Configuration

All settings live in `Config.json`. You can edit it directly or use the in-app Config Editor.

**Key settings:**

```json
{
  "fonts": {
    "family": "Times New Roman",
    "sizes": { "day_heading": 18, "topic_heading": 14, "body": 12 }
  },
  "colors": {
    "day_heading": "#FF8C00",
    "topic_heading": "#1F4788"
  },
  "page": {
    "margins": { "top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0 },
    "border": { "enabled": true, "width": 12 }
  },
  "header": { "enabled": true, "text": "My Notes", "color": "#FF8C00" },
  "footer": { "enabled": true, "show_page_numbers": true }
}
```

---

## 📋 AI Prompt Guide

The `prompt.txt` file contains a ready-to-use prompt that you paste into any AI assistant. It instructs the AI to format content using NotesForge's exact syntax — ensuring perfect auto-detection when imported into the app.

**Supported formatting rules the prompt enforces:**
- `Day XX -` and `Day XX - Title` headings
- `1. Topic: Name` numbered sections
- `- bullet` single-dash bullets
- `Example:`, `Steps:`, `Note:`, `Solution:`, `Commands:`, `Output:` labels
- `$ command` shell command prefix
- Space-separated tables
- Math symbols (×, ², ³, etc.)

---

## 🔧 Dependencies

```
streamlit>=1.28.0
python-docx>=0.8.11
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Open issues for bugs or feature requests
- Submit pull requests with improvements
- Create new themes and share them

Please read the license terms below before contributing.

---

## 📄 License

This project is licensed under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

**You are free to:**
- ✅ Use this project commercially or personally
- ✅ Modify and build upon it
- ✅ Distribute copies or modified versions

**Under the condition that:**
- 📌 **You must give appropriate credit** to the original author
- 📌 You must include a link to the original repository
- 📌 You must indicate if changes were made

See the full [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Ashish Krishna Pavan**
- 📧 Email: [ashishkrishnapavan@gmail.com](mailto:ashishkrishnapavan@gmail.com)
- 🐙 GitHub: [Ashish-Krishna-Pavan](https://github.com/Ashish-Krishna-Pavan-git)
- 🌐 Portfolio: [akpghub.live](https://akpghub.live)

> If you use NotesForge in your project or find it useful, a star ⭐ on the repo and a credit mention goes a long way!

---

## 🙏 Acknowledgements

Built with ❤️ using:
- [Streamlit](https://streamlit.io/) — for the web UI
- [python-docx](https://python-docx.readthedocs.io/) — for Word document generation
- [Claude (Anthropic)](https://claude.ai/) — AI-assisted development

---

<div align="center">
  Made with ❤️ by <strong>Ashish Krishna Pavan</strong> • <a href="mailto:ashishkrishnapavan@gmail.com">ashishkrishnapavan@gmail.com</a>
</div>
