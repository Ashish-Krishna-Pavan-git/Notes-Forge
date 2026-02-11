"""
Frontend.py - User Interface for NotesForge
Contains all Streamlit UI code with live editing capabilities
"""

import streamlit as st
from Config import ConfigManager
from Themes import ThemeManager
from Core import TextAnalyzer, DocumentBuilder, PDFBuilder


class NotesForgeUI:
    """Main UI class for NotesForge"""
    
    def __init__(self):
        # Initialize managers
        if 'config_manager' not in st.session_state:
            st.session_state.config_manager = ConfigManager()
        if 'theme_manager' not in st.session_state:
            st.session_state.theme_manager = ThemeManager()
        
        self.config = st.session_state.config_manager
        self.themes = st.session_state.theme_manager
    
    def setup_page(self):
        """Configure Streamlit page"""
        st.set_page_config(
            page_title=self.config.get('app.name', 'NotesForge Ultimate'),
            page_icon="📚",
            layout="wide",
            initial_sidebar_state="expanded"
        )
        
        # Custom CSS
        st.markdown("""
        <style>
        .big-title {
            font-size: 2.5rem;
            font-weight: bold;
            text-align: center;
            color: #FF8C00;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            text-align: center;
            color: #888;
            font-size: 1.1rem;
            margin-bottom: 1rem;
        }
        .feature-badge {
            display: inline-block;
            padding: 0.3rem 0.8rem;
            margin: 0.2rem;
            background: #FF8C00;
            color: white;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: bold;
        }
        .stButton>button {
            width: 100%;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def render_header(self):
        """Render app header"""
        st.markdown(
            f'<div class="big-title">{self.config.get("app.name", "NotesForge Ultimate")}</div>',
            unsafe_allow_html=True
        )
        st.markdown(
            f'<div class="subtitle">Version {self.config.get("app.version", "1.0")} - Professional Document Automation</div>',
            unsafe_allow_html=True
        )
        
        # Feature badges
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.markdown('<div style="text-align: center;"><span class="feature-badge">✨ Smart Detection</span></div>', unsafe_allow_html=True)
        with col2:
            st.markdown('<div style="text-align: center;"><span class="feature-badge">🎯 Works with ANY Format</span></div>', unsafe_allow_html=True)
        with col3:
            st.markdown('<div style="text-align: center;"><span class="feature-badge">⚡ Zero Errors</span></div>', unsafe_allow_html=True)
        with col4:
            st.markdown('<div style="text-align: center;"><span class="feature-badge">🎨 Professional Output</span></div>', unsafe_allow_html=True)
        
        st.markdown("---")
    
    def render_sidebar(self):
        """Render sidebar with settings"""
        with st.sidebar:
            st.header("⚙️ Settings & Features")
            
            # Theme selector
            st.subheader("🎨 Theme")
            current_theme = self.config.get('app.theme', 'professional')
            all_themes = self.themes.get_all_themes()
            
            theme_names = list(all_themes.keys())
            theme_labels = [all_themes[t]['name'] for t in theme_names]
            
            selected_idx = theme_names.index(current_theme) if current_theme in theme_names else 0
            
            new_theme = st.selectbox(
                "Select Theme",
                theme_names,
                index=selected_idx,
                format_func=lambda x: all_themes[x]['name']
            )
            
            if new_theme != current_theme:
                # Apply theme
                theme_data = self.themes.get_theme(new_theme)
                self.config.update_from_theme(theme_data)
                self.config.set('app.theme', new_theme)
                st.success(f"✅ Theme '{all_themes[new_theme]['name']}' applied!")
                st.rerun()
            
            st.caption(all_themes[new_theme].get('description', ''))
            
            st.markdown("---")
            # Theme Creator
            with st.expander("➕ Create New Theme"):
                st.markdown("**Create Your Own Theme:**")
                
                new_theme_name = st.text_input("Theme Name:", placeholder="My Awesome Theme")
                new_theme_desc = st.text_input("Description:", placeholder="Perfect for...")
                
                if st.button("🎨 Create Theme from Current Settings"):
                    if new_theme_name:
                        # Get current config as theme
                        theme_data = {
                            "name": new_theme_name,
                            "description": new_theme_desc,
                            "fonts": {
                                "family": self.config.get('fonts.family'),
                                "family_code": self.config.get('fonts.family_code'),
                                "sizes": {
                                    "day_heading": self.config.get('fonts.sizes.day_heading'),
                                    "day_heading_with_title": self.config.get('fonts.sizes.day_heading_with_title'),
                                    "topic_heading": self.config.get('fonts.sizes.topic_heading'),
                                    "section_heading": self.config.get('fonts.sizes.section_heading'),
                                    "body": self.config.get('fonts.sizes.body'),
                                    "code": self.config.get('fonts.sizes.code')
                                }
                            },
                            "colors": {
                                "day_heading": self.config.get('colors.day_heading'),
                                "topic_heading": self.config.get('colors.topic_heading'),
                                "section_heading": self.config.get('colors.section_heading'),
                                "code_background": self.config.get('colors.code_background')
                            },
                            "spacing": {
                                "line_spacing": self.config.get('spacing.line_spacing'),
                                "paragraph_spacing_after": self.config.get('spacing.paragraph_spacing_after'),
                                "heading_spacing_before": self.config.get('spacing.heading_spacing_before'),
                                "heading_spacing_after": self.config.get('spacing.heading_spacing_after')
                            },
                            "page": {
                                "border": {
                                    "enabled": self.config.get('page.border.enabled'),
                                    "width": self.config.get('page.border.width')
                                }
                            }
                        }
                        
                        # Add theme
                        theme_key = new_theme_name.lower().replace(" ", "_")
                        if self.themes.add_theme(theme_key, theme_data):
                            st.success(f"✅ Theme '{new_theme_name}' created!")
                            st.info("💡 Refresh page to see it in the dropdown")
                        else:
                            st.error("❌ Failed to create theme")
                    else:
                        st.warning("⚠️ Please enter a theme name")
            
            st.markdown("---")
            
            # Auto-Detects section
            st.subheader("🎯 Auto-Detects:")
            features = [
                "Day headings (Day XX -)",
                "Topic sections (1. Topic:)",
                "Numbered sections",
                "Bullet points",
                "Commands & code",
                "Tables (any format!)",
                "Examples & Steps",
                "Quotes & formulas",
                "File paths"
            ]
            for f in features:
                st.success(f"✅ {f}")
            
            st.markdown("---")
            
            # Output Format
            st.subheader("📋 Current Settings:")
            st.write(f"• **Font:** {self.config.get('fonts.family')}")
            st.write(f"• **Border:** {'Yes' if self.config.get('page.border.enabled') else 'No'}")
            st.write(f"• **Line spacing:** {self.config.get('spacing.line_spacing')}")
            st.write(f"• **Commands:** {len(self.config.get_commands())}")
            
            st.markdown("---")
            
            # Quick tips
            st.subheader("💡 Pro Tips:")
            st.info("""
            1. Use ChatGPT to format notes
            2. Paste ANY text - it works!
            3. Try different themes
            4. Add custom commands
            5. Export as DOCX or PDF
            """)
    
    def render_create_tab(self):
        """Render document creation tab"""
        col_input, col_preview = st.columns([1.5, 1])
        
        with col_input:
            st.subheader("📝 Input Your Notes")
            st.caption("Paste your notes here:")
            
            # Sample text
            sample = """Day 23 - 

Day 23 - Number Systems and Encoding Basics

1. Topic: Introduction to Number Systems
- Computers use numbers internally
- Different number systems exist
- Multiple purposes

Example:
- Decimal: Base 10
- Binary: Base 2
- Hexadecimal: Base 16

2. Topic: Binary Number System
- Base = 2
- Digits: 0 and 1
- Powers of 2

Commands:
$ python converter.py
$ chmod 755 script.sh

3. Topic: Conversion Table

Decimal   Binary   Hexadecimal
0         0000     0
15        1111     F
255       11111111 FF

Note:
- Always verify conversions
- Practice makes perfect"""
            
            input_text = st.text_area(
                "Text input",
                value=sample,
                height=450,
                label_visibility="collapsed"
            )
            
            # Output format and filename
            col_fmt, col_file = st.columns([1, 2])
            
            with col_fmt:
                output_format = st.selectbox(
                    "Format",
                    ["docx", "pdf"],
                    index=0
                )
            
            with col_file:
                filename = st.text_input(
                    "Filename:",
                    value=f"notes.{output_format}"
                )
        
        with col_preview:
            st.subheader("📊 Live Preview")
            
            if input_text.strip():
                # Analyze
                analyzer = TextAnalyzer(self.config.get_commands())
                stats = analyzer.analyze_document(input_text)
                
                # Display statistics
                st.markdown("**📈 Document Statistics:**")
                
                col_a, col_b = st.columns(2)
                
                with col_a:
                    st.metric("Total Lines", stats['total_lines'])
                    st.metric("Day Headings", stats['day_headings'])
                    st.metric("Topics", stats['topics'])
                    st.metric("Sections", stats['sections'])
                    st.metric("Bullets", stats['bullets'])
                
                with col_b:
                    st.metric("Commands", stats['commands'])
                    st.metric("Code Blocks", stats['code_blocks'])
                    st.metric("Tables", stats['tables'])
                    st.metric("Labels", stats['labels'])
                    st.metric("Formulas", stats['formulas'])
                
                st.markdown("---")
                
                # Quick preview
                st.markdown("**🔍 First Few Elements:**")
                
                lines = input_text.split('\n')
                preview_count = 0
                
                for line in lines:
                    if preview_count >= 8:
                        remaining = len([l for l in lines if l.strip()]) - preview_count
                        st.caption(f"...and {remaining} more lines")
                        break
                    
                    c = analyzer.classify_line(line)
                    if c['type'] == 'empty':
                        continue
                    
                    # Icons
                    icons = {
                        'heading_day': '📌',
                        'heading_day_with_title': '📌',
                        'topic_heading': '📘',
                        'section_heading': '📗',
                        'bullet': '•',
                        'command': '💻',
                        'table_row': '📊',
                        'label': '🏷️',
                        'quote': '💬',
                        'formula': '🔢',
                        'paragraph': '📄'
                    }
                    
                    icon = icons.get(c['type'], '📄')
                    content_preview = c['content'][:50]
                    if len(c['content']) > 50:
                        content_preview += "..."
                    
                    st.text(f"{icon} {c['type']}: {content_preview}")
                    preview_count += 1
        
        # Generate button
        st.markdown("---")
        if st.button("🚀 Generate Professional Document", type="primary", use_container_width=True):
            if not input_text.strip():
                st.error("⚠️ Please paste some text first!")
            else:
                try:
                    with st.spinner(f"🎨 Creating your professional {output_format.upper()}..."):
                        analyzer = TextAnalyzer(self.config.get_commands())
                        
                        if output_format == "pdf":
                            try:
                                builder = PDFBuilder(self.config, analyzer)
                                doc_path = builder.build_from_text(input_text)
                                
                                # Check if we got a DOCX instead of PDF
                                if doc_path.endswith('.docx'):
                                    st.warning("⚠️ PDF conversion not available. Generating DOCX instead.")
                                    st.info("💡 To enable PDF: Install Microsoft Word or use 'Print to PDF' from the DOCX file")
                                    output_format = "docx"  # Update format for download button
                                    
                            except Exception as e:
                                st.error(f"❌ PDF generation failed: {str(e)}")
                                st.info("💡 Generating DOCX instead...")
                                builder = DocumentBuilder(self.config, analyzer)
                                doc_path = builder.build_from_text(input_text)
                                output_format = "docx"
                        else:
                            builder = DocumentBuilder(self.config, analyzer)
                            doc_path = builder.build_from_text(input_text)
                    
                    # Download button
                    with open(doc_path, "rb") as f:
                        mime_type = "application/pdf" if output_format == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        
                        st.download_button(
                            label=f"📥 Download {output_format.upper()}",
                            data=f.read(),
                            file_name=filename,
                            mime=mime_type,
                            use_container_width=True
                        )
                    
                    st.success(f"✅ {output_format.upper()} created successfully!")
                    st.balloons()
                    
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
    
    def render_settings_tab(self):
        """Render settings customization tab"""
        st.subheader("⚙️ Customize Settings")
        
        tab_fonts, tab_colors, tab_spacing, tab_page, tab_commands = st.tabs([
            "🔤 Fonts", "🎨 Colors", "📏 Spacing", "📄 Page", "💻 Commands"
        ])
        
        with tab_fonts:
            st.markdown("### Font Settings")
            
            col1, col2 = st.columns(2)
            
            with col1:
                new_font = st.selectbox(
                    "Body Font Family",
                    ["Times New Roman", "Arial", "Calibri", "Georgia", "Verdana"],
                    index=0
                )
                if new_font != self.config.get('fonts.family'):
                    self.config.set('fonts.family', new_font)
                
                st.markdown("**Font Sizes:**")
                sizes = {
                    "Day Heading": "day_heading",
                    "Day with Title": "day_heading_with_title",
                    "Topic": "topic_heading",
                    "Section": "section_heading",
                    "Body": "body",
                    "Code": "code"
                }
                
                for label, key in sizes.items():
                    current = self.config.get(f'fonts.sizes.{key}', 12)
                    new_size = st.slider(
                        f"{label} Size",
                        8, 24, current,
                        key=f"size_{key}"
                    )
                    if new_size != current:
                        self.config.set(f'fonts.sizes.{key}', new_size)
            
            with col2:
                new_code_font = st.selectbox(
                    "Code Font Family",
                    ["Courier New", "Consolas", "Monaco", "Menlo"],
                    index=0
                )
                if new_code_font != self.config.get('fonts.family_code'):
                    self.config.set('fonts.family_code', new_code_font)
                
                st.info("💡 Font changes apply to next generated document")
            
            if st.button("💾 Save Font Settings", use_container_width=True):
                if self.config.save_config():
                    st.success("✅ Font settings saved!")
                else:
                    st.error("❌ Failed to save settings")
        
        with tab_colors:
            st.markdown("### Color Settings")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**Heading Colors:**")
                
                day_color = st.color_picker(
                    "Day Heading Color",
                    self.config.get('colors.day_heading', '#FF8C00')
                )
                if day_color != self.config.get('colors.day_heading'):
                    self.config.set('colors.day_heading', day_color)
                
                topic_color = st.color_picker(
                    "Topic Heading Color",
                    self.config.get('colors.topic_heading', '#1F4788')
                )
                if topic_color != self.config.get('colors.topic_heading'):
                    self.config.set('colors.topic_heading', topic_color)
                
                section_color = st.color_picker(
                    "Section Heading Color",
                    self.config.get('colors.section_heading', '#2E5C8A')
                )
                if section_color != self.config.get('colors.section_heading'):
                    self.config.set('colors.section_heading', section_color)
            
            with col2:
                st.markdown("**Other Colors:**")
                
                code_bg = st.color_picker(
                    "Code Background",
                    self.config.get('colors.code_background', '#F5F5F5')
                )
                if code_bg != self.config.get('colors.code_background'):
                    self.config.set('colors.code_background', code_bg)
                
                table_header = st.color_picker(
                    "Table Header",
                    self.config.get('colors.table_header_bg', '#4A7BA7')
                )
                if table_header != self.config.get('colors.table_header_bg'):
                    self.config.set('colors.table_header_bg', table_header)
            
            if st.button("💾 Save Color Settings", use_container_width=True):
                if self.config.save_config():
                    st.success("✅ Color settings saved!")
                else:
                    st.error("❌ Failed to save settings")
        
        with tab_spacing:
            st.markdown("### Spacing Settings")
            
            col1, col2 = st.columns(2)
            
            with col1:
                line_spacing = st.slider(
                    "Line Spacing",
                    1.0, 2.0,
                    self.config.get('spacing.line_spacing', 1.5),
                    0.1
                )
                if line_spacing != self.config.get('spacing.line_spacing'):
                    self.config.set('spacing.line_spacing', line_spacing)
                
                para_spacing = st.slider(
                    "Paragraph Spacing (pt)",
                    0, 18,
                    self.config.get('spacing.paragraph_spacing_after', 6)
                )
                if para_spacing != self.config.get('spacing.paragraph_spacing_after'):
                    self.config.set('spacing.paragraph_spacing_after', para_spacing)
            
            with col2:
                heading_before = st.slider(
                    "Heading Space Before (pt)",
                    0, 24,
                    self.config.get('spacing.heading_spacing_before', 12)
                )
                if heading_before != self.config.get('spacing.heading_spacing_before'):
                    self.config.set('spacing.heading_spacing_before', heading_before)
                
                heading_after = st.slider(
                    "Heading Space After (pt)",
                    0, 18,
                    self.config.get('spacing.heading_spacing_after', 6)
                )
                if heading_after != self.config.get('spacing.heading_spacing_after'):
                    self.config.set('spacing.heading_spacing_after', heading_after)
            
            if st.button("💾 Save Spacing Settings", use_container_width=True):
                if self.config.save_config():
                    st.success("✅ Spacing settings saved!")
                else:
                    st.error("❌ Failed to save settings")
        
        with tab_page:
            st.markdown("### Page Settings")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**Margins (inches):**")
                
                margin_top = st.slider("Top", 0.5, 2.0, self.config.get('page.margins.top', 1.0), 0.1)
                if margin_top != self.config.get('page.margins.top'):
                    self.config.set('page.margins.top', margin_top)
                
                margin_bottom = st.slider("Bottom", 0.5, 2.0, self.config.get('page.margins.bottom', 1.0), 0.1)
                if margin_bottom != self.config.get('page.margins.bottom'):
                    self.config.set('page.margins.bottom', margin_bottom)
                
                margin_left = st.slider("Left", 0.5, 2.0, self.config.get('page.margins.left', 1.0), 0.1)
                if margin_left != self.config.get('page.margins.left'):
                    self.config.set('page.margins.left', margin_left)
                
                margin_right = st.slider("Right", 0.5, 2.0, self.config.get('page.margins.right', 1.0), 0.1)
                if margin_right != self.config.get('page.margins.right'):
                    self.config.set('page.margins.right', margin_right)
            
            with col2:
                st.markdown("**Border:**")
                
                border_enabled = st.checkbox(
                    "Enable Border",
                    value=self.config.get('page.border.enabled', True)
                )
                if border_enabled != self.config.get('page.border.enabled'):
                    self.config.set('page.border.enabled', border_enabled)
                
                if border_enabled:
                    border_width = st.slider(
                        "Border Width",
                        4, 24,
                        self.config.get('page.border.width', 12)
                    )
                    if border_width != self.config.get('page.border.width'):
                        self.config.set('page.border.width', border_width)
                
                st.markdown("**Header/Footer:**")
                
                header_enabled = st.checkbox(
                    "Enable Header",
                    value=self.config.get('header.enabled', True)
                )
                if header_enabled != self.config.get('header.enabled'):
                    self.config.set('header.enabled', header_enabled)
                
                footer_enabled = st.checkbox(
                    "Enable Footer",
                    value=self.config.get('footer.enabled', True)
                )
                if footer_enabled != self.config.get('footer.enabled'):
                    self.config.set('footer.enabled', footer_enabled)
                    st.markdown("**Custom Header:**")
                
                header_text = st.text_input(
                    "Header Text:",
                    value=self.config.get('header.text', 'NotesForge Ultimate by AKP'),
                    help="Text shown in document header"
                )
                if header_text != self.config.get('header.text'):
                    self.config.set('header.text', header_text)
                
                col_h1, col_h2 = st.columns(2)
                with col_h1:
                    header_size = st.slider(
                        "Header Size",
                        8, 16,
                        self.config.get('header.size', 11)
                    )
                    if header_size != self.config.get('header.size'):
                        self.config.set('header.size', header_size)
                
                with col_h2:
                    header_color = st.color_picker(
                        "Header Color",
                        self.config.get('header.color', '#FF8C00')
                    )
                    if header_color != self.config.get('header.color'):
                        self.config.set('header.color', header_color)
                
                header_bold = st.checkbox(
                    "Bold Header",
                    value=self.config.get('header.bold', True)
                )
                if header_bold != self.config.get('header.bold'):
                    self.config.set('header.bold', header_bold)
            
            if st.button("💾 Save Page Settings", use_container_width=True):
                if self.config.save_config():
                    st.success("✅ Page settings saved!")
                else:
                    st.error("❌ Failed to save settings")
        
        with tab_commands:
            st.markdown("### Command Management")
            
            # Display current commands
            commands = self.config.get_commands()
            st.info(f"**Total Commands:** {len(commands)}")
            
            # Add command
            col1, col2 = st.columns([3, 1])
            with col1:
                new_command = st.text_input("Add New Command:", placeholder="e.g., terraform")
            with col2:
                st.write("")  # Spacing
                st.write("")  # Spacing
                if st.button("➕ Add"):
                    if new_command and new_command.strip():
                        if self.config.add_command(new_command.strip()):
                            st.success(f"✅ Added '{new_command}'!")
                            st.rerun()
                        else:
                            st.warning(f"⚠️ '{new_command}' already exists!")
            
            # Show commands
            st.markdown("**Current Commands:**")
            
            # Create columns for command display
            cols_per_row = 5
            commands_sorted = sorted(commands)
            
            for i in range(0, len(commands_sorted), cols_per_row):
                cols = st.columns(cols_per_row)
                for j, cmd in enumerate(commands_sorted[i:i+cols_per_row]):
                    with cols[j]:
                        st.text(f"• {cmd}")
            
            st.markdown("---")
            st.caption("💡 These commands are auto-detected in your text!")
    
    def render_help_tab(self):
        """Render help and documentation tab"""
        st.markdown("""
        ## 📖 How to Use NotesForge
        
        ### 🚀 Quick Start (30 seconds!)
        1. **Paste** your notes in the "Create Document" tab
        2. **Check** the live preview and statistics
        3. **Select** output format (DOCX or PDF)
        4. **Click** "Generate Professional Document"
        5. **Download** your file!
        
        ### 🎯 What Gets Auto-Detected
        
        **Headings:**
        ```
        Day 23 -              → Orange, 18pt, bold
        Day 23 - Linux Basics → Orange, 16pt, bold
        1. Topic: Name        → Navy, 14pt, bold
        2. Section Name       → Blue, 13pt, bold
        ```
        
        **Lists:**
        ```
        - Item                → Bullet point
        • Item                → Bullet point
        1) Item               → Numbered list
        ```
        
        **Code & Commands:**
        ```
        $ ls -lah             → Auto-detected command
        chmod 755             → Auto-detected (50+ commands!)
        /path/to/file         → File path formatting
        ```
        
        **Tables (Any Format!):**
        ```
        Col1   Col2   Col3   → Space-separated (3+ spaces)
        Col1 | Col2 | Col3   → Pipe-separated
        Col1	Col2	Col3    → Tab-separated
        ```
        
        **Special Content:**
        ```
        Example:              → Bold label
        Steps:                → Bold label
        Note:                 → Bold label
        "Quote"               → Italic, indented
        2×10³                 → Formula formatting
        ```
        
        ### 🎨 Using Themes
        
        1. Go to sidebar
        2. Select a theme from dropdown
        3. Theme applies instantly!
        
        **Available Themes:**
        - **Professional** - Classic orange accents
        - **Academic** - Double-spaced papers
        - **Modern** - Clean Calibri design
        - **Minimal** - Simple black & white
        - **Book** - Serif fonts for books
        - **Colorful** - Vibrant for presentations
        
        ### ⚙️ Customizing Settings
        
        Go to "Settings" tab to customize:
        
        **Fonts:**
        - Change font family
        - Adjust all font sizes
        - Set code font
        
        **Colors:**
        - Heading colors
        - Code background
        - Table colors
        
        **Spacing:**
        - Line spacing
        - Paragraph spacing
        - Heading spacing
        
        **Page:**
        - Margins
        - Border on/off
        - Header/footer
        
        **Commands:**
        - Add custom commands
        - View all commands
        - Commands auto-detected in text!
        
        ### 💡 Pro Tips
        
        1. **Use ChatGPT** to format handwritten notes
        2. **Try different themes** for different purposes
        3. **Add custom commands** for your specific tools
        4. **Check preview** before generating
        5. **Export as PDF** for sharing, DOCX for editing
        
        ### 🔥 Advanced Features
        
        - **Live editing**: Change settings and generate again
        - **Theme switching**: Try themes to find your style
        - **Command detection**: 50+ commands recognized automatically
        - **Table parsing**: Works with any table format
        - **Both outputs**: DOCX for editing, PDF for sharing
        
        ### ❓ Need Help?
        
        - Check the preview to see what was detected
        - Try the sample text to see how it works
        - Use themes as starting points for customization
        - Save your settings for future use
        
        ---
        
        **NotesForge Ultimate by AKP** - Professional document automation made easy!
        """)
    
    def run(self):
        """Main function to run the UI"""
        self.setup_page()
        self.render_header()
        self.render_sidebar()
        
        # Main tabs
        tab1, tab2, tab3 = st.tabs(["📝 Create Document", "⚙️ Settings", "📖 Help"])
        
        with tab1:
            self.render_create_tab()
        
        with tab2:
            self.render_settings_tab()
        
        with tab3:
            self.render_help_tab()
        
        # Footer
        st.markdown("---")
        st.markdown("""
        <div style="text-align: center; color: #888;">
            <p><b style="color: #FF8C00;">NotesForge Ultimate by AKP</b></p>
            <p>Modular architecture - Total customization - Professional output</p>
        </div>
        """, unsafe_allow_html=True)
