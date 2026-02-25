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


if __name__ == "__main__":
    unittest.main()
