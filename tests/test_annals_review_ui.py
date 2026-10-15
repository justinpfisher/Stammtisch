from html.parser import HTMLParser
from pathlib import Path
import unittest


class ElementAncestry(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.stack = []
        self.parents = {}
        self.attributes = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        identity = attributes.get("id")
        if identity:
            self.parents[identity] = [item_id for _, item_id in self.stack if item_id]
            self.attributes[identity] = attributes
        if tag not in self.VOID:
            self.stack.append((tag, identity))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break


class AnnalsReviewVisibility(unittest.TestCase):
    def test_held_quote_recovery_is_independent_of_published_only_visibility(self):
        parser = ElementAncestry()
        source = Path(__file__).parents[1] / "scripts" / "annals" / "ReviewUi.html"
        parser.feed(source.read_text(encoding="utf-8"))
        self.assertIn("detail", parser.parents["quoteRecovery"])
        self.assertNotIn("publishedActions", parser.parents["quoteRecovery"])
        self.assertIn("hidden", parser.attributes["quoteRecovery"])
        self.assertIn("publishedActions", parser.parents["removalBox"])
        self.assertIn("quoteRecovery", parser.parents["reassessHeldQuote"])
