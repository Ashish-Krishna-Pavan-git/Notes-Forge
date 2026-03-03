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


if __name__ == "__main__":
    unittest.main()
