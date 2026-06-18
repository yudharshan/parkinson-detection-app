"""Smoke test for doctor invite codes, patient IDs, linking, roster, and feature output."""
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


sfx = random.randint(1000, 9999)

# 1. patient signup -> patientCode
st, pat = call("POST", "/auth/signup", {"name": "Pat", "email": f"pat{sfx}@t.com", "password": "pass1234"})
print("patient signup:", st, "patientCode=", pat.get("patientCode"))
pcode = pat["patientCode"]

# 2. doctor signup with BAD code -> 403
st, _ = call("POST", "/auth/signup", {"name": "Dr No", "email": f"bad{sfx}@t.com", "password": "p", "role": "doctor", "doctorCode": "WRONG"})
print("doctor signup (bad code):", st, "(expect 403)")

# 3. doctor signup with GOOD code -> 201 clinician
st, doc = call("POST", "/auth/signup", {"name": "Dr Smith", "email": f"doc{sfx}@t.com", "password": "pass1234", "role": "doctor", "doctorCode": "NEURO-2024"})
print("doctor signup (good code):", st, "role=", doc.get("role"))

# 4. doctor login
st, dlogin = call("POST", "/auth/login", {"email": f"doc{sfx}@t.com", "password": "pass1234"})
dtoken, dId = dlogin["token"], dlogin["userId"]
print("doctor login:", st, "role=", dlogin.get("role"))

# 5. doctor links the patient by code
st, link = call("POST", "/clinician/link", {"patientCode": pcode}, token=dtoken)
print("link patient:", st, link.get("data"))

# 6. patient takes a tapping test (verify features now returned)
st, plogin = call("POST", "/auth/login", {"email": f"pat{sfx}@t.com", "password": "pass1234"})
ptoken, pId = plogin["token"], plogin["userId"]
tap = dataio.load_tapping()[7]
st, tres = call("POST", "/test/tapping", {"rawTaps": tap["raw"], "medTimepoint": tap["medTimepoint"], "userId": pId}, token=ptoken)
feats = tres["data"].get("rawFeatures")
print("tapping features populated:", bool(feats), "->", {k: feats[k] for k in list(feats)[:3]} if feats else None)

# 7. doctor roster shows the linked patient
st, roster = call("GET", f"/clinician/roster/{dId}", token=dtoken)
print("roster:", st, [(r["name"], r["patientCode"], r["status"]) for r in roster["data"]])
