import importlib.util
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

spec = importlib.util.spec_from_file_location("app", ROOT / "app.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AppTests(unittest.TestCase):
    def test_emit_sse_format(self):
        payload = module.emit_sse("token", {"text": "Hi"})
        self.assertEqual(payload, "event: token\ndata: {\"text\": \"Hi\"}\n\n")


if __name__ == "__main__":
    unittest.main()
