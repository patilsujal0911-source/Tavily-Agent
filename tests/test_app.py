import importlib.util
import pathlib
import sys
import unittest
from unittest import mock

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

    def test_chat_uses_demo_mode_when_model_is_unavailable(self):
        with mock.patch.object(module, "get_graph", side_effect=RuntimeError("RESOURCE_EXHAUSTED: 429")):
            client = module.app.test_client()
            response = client.post("/chat", json={"message": "hello"})

        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        self.assertIn("event: done", body)
        self.assertIn("Demo mode is active", body)

    def test_app_prefills_message_from_query_string(self):
        client = module.app.test_client()
        response = client.get("/app?message=what%20is%20rate%20of%20gold")

        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        self.assertIn("what is rate of gold", body)


if __name__ == "__main__":
    unittest.main()
