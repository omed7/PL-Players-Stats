import pytest
import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

def get_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

PORT = get_free_port()
SERVER_URL = f"http://localhost:{PORT}"
server_thread = None
httpd = None

def start_server():
    global httpd
    Handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), Handler)
    httpd.serve_forever()

@pytest.fixture(scope="session", autouse=True)
def setup_server():
    global server_thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1) # wait for server to start
    yield
    if httpd:
        httpd.shutdown()

@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

@pytest.fixture(scope="function")
def page(browser):
    page = browser.new_page()
    yield page
    page.close()

def test_no_filtered_players(page):
    # Load the index page
    page.goto(SERVER_URL)

    # Wait for the table body to be present and populated initially
    page.wait_for_selector('#table-body tr')

    # Execute JavaScript to simulate the edge case
    page.evaluate('''() => {
        // Set filteredPlayers to empty array
        state.filteredPlayers = [];
        // Re-render the table
        renderTable();
    }''')

    # Wait for the expected empty message row to appear
    # The message row should have td with colspan 7 and text "No players found matching criteria."
    page.wait_for_selector('td:has-text("No players found matching criteria.")')

    # Verify that there's exactly one row in the table body
    row_count = page.locator('#table-body tr').count()
    assert row_count == 1, f"Expected 1 row, but found {row_count}"

    # Verify the text content of the message
    td_text = page.locator('#table-body tr td').inner_text()
    assert td_text == "No players found matching criteria."
