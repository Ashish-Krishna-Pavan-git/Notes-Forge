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


if __name__ == "__main__":
    unittest.main()
