import unittest

from app.parser import parse_notesforge, to_markdown
from app.templates_repo import SAMPLE_EXAMPLE


class ParserTests(unittest.TestCase):
    def test_parser_extracts_structure(self) -> None:
        result = parse_notesforge(SAMPLE_EXAMPLE)
        self.assertGreater(result.summary.word_count, 20)
        self.assertGreaterEqual(result.summary.heading_count, 4)
        self.assertTrue(any(node.type == "table" for node in result.nodes))
        self.assertTrue(any(node.type == "code" for node in result.nodes))

    def test_markdown_conversion_contains_expected_sections(self) -> None:
        result = parse_notesforge(SAMPLE_EXAMPLE)
        md = to_markdown(result.nodes)
        self.assertIn("# NotesForge", md)
        self.assertIn("- Initial detection via IDS alert.", md)

    def test_parser_supports_alignment_ascii_and_pagebreak(self) -> None:
        content = (
            "H1: Demo\n"
            "CENTER: centered paragraph\n"
            "RIGHT: right paragraph\n"
            "JUSTIFY: justified paragraph\n"
            "ASCII: +--+\n"
            "PAGEBREAK:\n"
            "PARAGRAPH: after break\n"
        )
        result = parse_notesforge(content)
        self.assertTrue(any(n.type == "ascii" for n in result.nodes))
        self.assertTrue(any(n.type == "pagebreak" for n in result.nodes))
        self.assertTrue(
            any(n.type == "paragraph" and n.align == "center" for n in result.nodes)
        )
        self.assertTrue(
            any(n.type == "paragraph" and n.align == "justify" for n in result.nodes)
        )

    def test_parser_preserves_multiline_code_ascii_and_justify_paragraph(self) -> None:
        content = (
            "JUSTIFY: first justified line\n"
            "second justified line\n"
            "CODE: print('one')\n"
            "for i in range(2):\n"
            "    print(i)\n"
            "ASCII: +---+\n"
            "| A |\n"
            "+---+\n"
        )
        result = parse_notesforge(content)

        justified = [n for n in result.nodes if n.type == "paragraph" and n.align == "justify"]
        self.assertEqual(len(justified), 1)
        self.assertIn("first justified line", justified[0].text)
        self.assertIn("second justified line", justified[0].text)

        code_nodes = [n for n in result.nodes if n.type == "code"]
        self.assertEqual(len(code_nodes), 1)
        self.assertIn("print('one')", code_nodes[0].text)
        self.assertIn("for i in range(2):", code_nodes[0].text)

        ascii_nodes = [n for n in result.nodes if n.type == "ascii"]
        self.assertEqual(len(ascii_nodes), 1)
        self.assertIn("| A |", ascii_nodes[0].text)

    def test_parser_supports_multiline_ascii_and_table_padding(self) -> None:
        content = (
            "H1: Demo\n"
            "ASCII: +-----+\n"
            "| box |\n"
            "+-----+\n"
            "TABLE: A | B | C\n"
            "TABLE: 1 | 2\n"
        )
        result = parse_notesforge(content)
        ascii_nodes = [n for n in result.nodes if n.type == "ascii"]
        self.assertEqual(len(ascii_nodes), 1)
        self.assertIn("| box |", ascii_nodes[0].text)

        tables = [n for n in result.nodes if n.type == "table"]
        self.assertEqual(len(tables), 1)
        rows = tables[0].rows or []
        self.assertEqual(len(rows[0]), 3)
        self.assertEqual(len(rows[1]), 3)
        self.assertEqual(rows[1][2], "")

    def test_parser_supports_legacy_heading_markers(self) -> None:
        content = (
            "HEADING: Legacy Title\n"
            "SUBHEADING: Legacy Section\n"
            "SUB-SUBHEADING: Legacy Subsection\n"
            "PARA: body copy\n"
            "PAGE_BREAK:\n"
            "PARAGRAPH: after break\n"
        )
        result = parse_notesforge(content)
        heading_levels = [n.level for n in result.nodes if n.type == "heading"]
        self.assertIn(1, heading_levels)
        self.assertIn(2, heading_levels)
        self.assertIn(3, heading_levels)
        self.assertTrue(any(n.type == "pagebreak" for n in result.nodes))

    def test_parser_merges_consecutive_table_markers_as_rows(self) -> None:
        content = (
            "H1: Table Demo\n"
            "TABLE: Device | IP\n"
            "TABLE: PC0 | 192.168.0.11\n"
            "TABLE: Laptop1 | 192.168.1.13\n"
        )
        result = parse_notesforge(content)
        tables = [n for n in result.nodes if n.type == "table"]
        self.assertEqual(len(tables), 1)
        self.assertEqual(len(tables[0].rows or []), 3)

    def test_parser_tracks_quote_role_and_list_indent_levels(self) -> None:
        content = (
            "QUOTE: Important quoted text\n"
            "BULLET: Parent item\n"
            "BULLET:   Child item\n"
            "NUMBERED: 1. Parent step\n"
            "NUMBERED:   2. Child step\n"
        )
        result = parse_notesforge(content)

        quote_nodes = [n for n in result.nodes if n.type == "paragraph" and n.role == "quote"]
        self.assertEqual(len(quote_nodes), 1)
        self.assertIn("Important quoted text", quote_nodes[0].text)

        bullet_nodes = [n for n in result.nodes if n.type == "bullet"]
        self.assertEqual(len(bullet_nodes), 1)
        self.assertEqual(bullet_nodes[0].items, ["Parent item", "Child item"])
        self.assertEqual(bullet_nodes[0].levels, [0, 1])

        numbered_nodes = [n for n in result.nodes if n.type == "numbered"]
        self.assertEqual(len(numbered_nodes), 1)
        self.assertEqual(numbered_nodes[0].items, ["Parent step", "Child step"])
        self.assertEqual(numbered_nodes[0].levels, [0, 1])


if __name__ == "__main__":
    unittest.main()
