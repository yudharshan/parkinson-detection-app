"""Integration smoke test: drives the Node backend over HTTP, which in turn calls
the FastAPI ML service. Proves the full chain end to end with real sample data.
Run with both servers up:  python smoke_test.py
"""
import json, random, urllib.request, urllib.error
import dataio

BASE = "http://127.0.0.1:5000/api"


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


email = f"demo{random.randint(1000,9999)}@test.com"
print("signup:", call("POST", "/auth/signup", {"name": "Demo", "email": email, "password": "pass1234"})[0])
st, login = call("POST", "/auth/login", {"email": email, "password": "pass1234"})
token, uid = login["token"], login["userId"]
print("login :", st, "userId=", uid)

tap = dataio.load_tapping()
trem = dataio.load_tremor()

cases = [
    ("/test/tapping", "rawTaps", tap[1], "healthy tapping (no meds)"),
    ("/test/tapping", "rawTaps", tap[7], "impaired tapping (before meds)"),
    ("/test/tremor", "rawSamples", trem[1], "tremor (no meds)"),
    ("/test/tremor", "rawSamples", trem[19], "tremor (before meds)"),
]
for path, key, rec, desc in cases:
    st, resp = call("POST", path, {key: rec["raw"], "medTimepoint": rec["medTimepoint"], "userId": uid}, token)
    d = resp.get("data", {})
    print(f"  {desc:34s} -> {st}  score={d.get('severityScore')}  interp={d.get('interpretation')}")

st, hist = call("GET", f"/tests/history/{uid}", token=token)
print(f"history: {st}  {len(hist['data'])} sessions stored for this user")
