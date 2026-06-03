import requests
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class BurpSuiteClient:
    """
    Thin HTTP client for the Burp Suite Professional REST API (v0.1).

    Burp REST API docs:
      https://portswigger.net/burp/documentation/desktop/tools/burp-api

    The REST API is only available in Burp Suite Professional. It binds to
    localhost:1337 on the machine running Burp (configurable in User options).

    Key endpoints used by this client:
        GET  /v0.1/scan                            - list all scan tasks
        GET  /v0.1/scan/{task_id}                  - get status of a scan task
        GET  /v0.1/scan/{task_id}/issues           - get all issues for a task
        POST /v0.1/scan                            - start a new active scan
        GET  /v0.1/knowledge_base/issue_definitions- list all known issue types
        PUT  /v0.1/target/scope                    - set/replace target scope
        POST /v0.1/target/scope                    - add URLs to target scope

    Docker networking note:
        If r3ngine runs in Docker and Burp runs on the host, use
        'http://host.docker.internal:1337' as the API URL.
    """

    def __init__(self, api_url: str, api_key: str = ""):
        """
        Initialize the Burp Suite REST API client.

        Args:
            api_url (str): Base URL of the Burp REST API.
                           e.g. 'http://host.docker.internal:1337'
            api_key (str): Optional API key if Burp is configured to require
                           authentication (Burp User options → REST API → API key).
        """
        self.base_url = api_url.rstrip("/")
        self.api_key = api_key
        self.session = requests.Session()

        # Set auth header if an API key is configured
        if api_key:
            self.session.headers["Authorization"] = f"Bearer {api_key}"

        self.session.headers["Content-Type"] = "application/json"
        self.session.headers["Accept"] = "application/json"

    def health_check(self) -> dict:
        """
        Verify connectivity to the Burp Suite REST API.

        Calls GET /v0.1/scan with a short timeout to check reachability.

        Returns:
            dict: {'status': 'ok'|'error', 'message': str}
        """
        try:
            r = self.session.get(f"{self.base_url}/v0.1/scan", timeout=10)
            r.raise_for_status()
            return {
                "status": "ok",
                "message": f"Connected to Burp Suite API at {self.base_url}",
                "scan_count": len(r.json()) if isinstance(r.json(), list) else 0,
            }
        except requests.ConnectionError:
            return {
                "status": "error",
                "message": (
                    f"Cannot connect to Burp Suite at {self.base_url}. "
                    "Is Burp Suite Pro running with the REST API enabled?"
                ),
            }
        except requests.HTTPError as e:
            return {
                "status": "error",
                "message": f"Burp API returned HTTP error: {e}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Unexpected error: {e}",
            }

    def get_scan_tasks(self) -> list:
        """
        List all scan tasks from Burp Suite.

        Calls GET /v0.1/scan.

        Returns:
            list: List of scan task dicts (task_id, status, urls, etc.).

        Raises:
            requests.HTTPError: If the API returns an error status.
        """
        r = self.session.get(f"{self.base_url}/v0.1/scan", timeout=30)
        r.raise_for_status()
        data = r.json()
        # Burp returns a list directly
        return data if isinstance(data, list) else []

    def get_scan_issues(self, task_id: str) -> list:
        """
        Retrieve all issues found by a specific Burp scan task.

        Calls GET /v0.1/scan/{task_id}/issues.

        Args:
            task_id (str): The Burp scan task ID.

        Returns:
            list: List of issue dicts from Burp. Each issue contains:
                  type_id, serial_number, name, severity, confidence,
                  host, path, issue_detail, issue_background,
                  remediation_detail, remediation_background.

        Raises:
            requests.HTTPError: If the API returns an error status.
        """
        r = self.session.get(
            f"{self.base_url}/v0.1/scan/{task_id}/issues",
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        # Burp wraps issues in {"issues": [...]}
        if isinstance(data, dict):
            return data.get("issues", [])
        return data if isinstance(data, list) else []

    def get_all_issues(self) -> list:
        """
        Retrieve issues from ALL scan tasks, aggregated into one list.

        Used when no specific task_id is requested (full import mode).
        Silently skips tasks that fail to return issues.

        Returns:
            list: Combined list of all issues from all scan tasks.
        """
        all_issues = []
        try:
            tasks = self.get_scan_tasks()
        except Exception as e:
            logger.error(f"BurpSuiteClient.get_all_issues: failed to list tasks: {e}")
            return []

        for task in tasks:
            task_id = task.get("task_id") or task.get("id")
            if not task_id:
                continue
            try:
                issues = self.get_scan_issues(str(task_id))
                all_issues.extend(issues)
                logger.debug(
                    f"BurpSuiteClient: fetched {len(issues)} issues from task {task_id}"
                )
            except Exception as e:
                logger.warning(
                    f"BurpSuiteClient: skipping task {task_id} due to error: {e}"
                )

        return all_issues

    def add_to_scope(self, urls: list) -> bool:
        """
        Add a list of URLs to Burp Suite's target scope.

        Calls POST /v0.1/target/scope with an 'include' rule for each URL.

        Args:
            urls (list): List of URL strings to add to scope.
                         e.g. ['https://example.com', 'https://sub.example.com']

        Returns:
            bool: True if the request succeeded (2xx status), False otherwise.
        """
        if not urls:
            return True

        payload = {"include": [{"rule": url} for url in urls]}
        try:
            r = self.session.post(
                f"{self.base_url}/v0.1/target/scope",
                json=payload,
                timeout=30,
            )
            return r.status_code in (200, 201, 204)
        except Exception as e:
            logger.error(f"BurpSuiteClient.add_to_scope failed: {e}")
            return False

    def start_scan(self, urls: list) -> Optional[str]:
        """
        Start a Burp Suite active scan against a list of URLs.

        Calls POST /v0.1/scan.

        Args:
            urls (list): List of URL strings to scan actively.

        Returns:
            str: The Burp task_id string on success.
            None: If the request fails.

        Raises:
            requests.HTTPError: If Burp returns an error status.
        """
        if not urls:
            return None

        payload = {
            "scan_configurations": [],
            "urls": urls,
        }
        r = self.session.post(f"{self.base_url}/v0.1/scan", json=payload, timeout=30)
        r.raise_for_status()
        return str(r.json().get("task_id", ""))
