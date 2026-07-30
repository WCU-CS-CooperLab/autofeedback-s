"""Runs whatever test files the STUDENT wrote in their own repo (not
teacher-bundled tests) and grades based on those results. No reference
implementation, no fixtures needed — the student's tests are the tests.

Assumes Python + pytest. Discovers every test_*.py / *_test.py under the
student's checkout (cwd) automatically — nothing here is specific to one
assignment's file names, so this same autograder.py can usually be reused
as-is across assignments (or even set as the classroom default via
`gh teacher autograder set-default`, since it has no per-assignment fixtures).

Per-test weight: every discovered test is worth DEFAULT_WEIGHT points
unless you list it in WEIGHTS by its pytest nodeid (e.g.
"test_hello.py::test_uppercase"). Leave WEIGHTS empty for equal weighting.
"""

import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

CWD = Path.cwd()  # student's repo checkout
REPORT = CWD / ".autograder-pytest-report.json"

WEIGHTS = {}
DEFAULT_WEIGHT = 1


def emit(score, max_score, tests, note=""):
    result = {
        "schema": "classroom50/result/v1",
        "classroom": os.environ["CLASSROOM"],
        "assignment": os.environ["ASSIGNMENT"],
        "usernames": [os.environ["USERNAME"]],
        "submission": os.environ["SUBMISSION_TAG"],
        "commit": os.environ["COMMIT_URL"],
        "release": os.environ["RELEASE_URL"],
        "review": os.environ["COMMIT_URL"],
        "datetime": datetime.datetime.now(datetime.timezone.utc)
                     .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "score": score,
        "max-score": max_score,
        "tests": tests,
    }
    Path("result.json").write_text(json.dumps(result, indent=2))
    if note:
        print(note)


# Install pytest + the JSON report plugin into the runner's own toolchain
# (not the student's repo) so this works regardless of what the student
# did or didn't put in a requirements file.
subprocess.run(
    [sys.executable, "-m", "pip", "install", "--quiet", "--user",
     "pytest", "pytest-json-report"],
    check=True,
)

# Run against the student's own checkout. pytest's default discovery
# (test_*.py / *_test.py, anywhere under cwd) means this picks up
# whatever the student wrote, wherever they put it — no assignment-
# specific filename assumptions.
result = subprocess.run(
    [sys.executable, "-m", "pytest", str(CWD),
     "--json-report", f"--json-report-file={REPORT}",
     "-q", "--no-header"],
    cwd=str(CWD),
    check=False,
)

if not REPORT.is_file():
    # pytest couldn't even produce a report — usually a collection error
    # (syntax error in a test file, missing import, etc.), not "no tests
    # exist" (that's reported normally, as zero tests below).
    emit(0, 0, [], note="::error::pytest did not produce a JSON report")
    sys.exit(0)  # ran end-to-end; the zero score is the honest result

data = json.loads(REPORT.read_text())
REPORT.unlink(missing_ok=True)  # don't leave scratch files in the graded repo

raw_tests = data.get("tests", [])
if not raw_tests:
    # No test files found at all. This is a legitimate outcome to
    # surface plainly (score 0/0) rather than synthesize a fake failing
    # test — a vacuous "0 tests" is informative on its own in the
    # release/commit-status summary.
    emit(0, 0, [], note="No tests were discovered in the submission.")
    sys.exit(0)

tests = []
for t in raw_tests:
    nodeid = t.get("nodeid", "")
    passed = t.get("outcome") == "passed"
    weight = WEIGHTS.get(nodeid, DEFAULT_WEIGHT)
    tests.append({
        "test-name": nodeid,
        "passed": passed,
        "score": weight if passed else 0,
        "max-score": weight,
    })

emit(
    sum(t["score"] for t in tests),
    sum(t["max-score"] for t in tests),
    tests,
)
