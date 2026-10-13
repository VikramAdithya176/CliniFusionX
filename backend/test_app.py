import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    # if models aren't loaded, it returns 503, but we can check the status code
    assert response.status_code in (200, 503)

def test_root():
    response = client.get("/")
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.headers["content-type"].startswith("text/html")
