"""Conservative, no-key public-source research for new Celebration death reports.

Wikidata alone is never treated as proof. A matching identity, dated Wikidata
statement and TWO independently published, readable reports are required.
If they are absent or inaccessible the caller must request human review.
No private workbook content is sent anywhere beyond the already-public name/DOB.
"""
from datetime import date, datetime, timezone
from html import unescape
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
import json
import re
import unicodedata

API = "https://www.wikidata.org/w/api.php"
UA = "StammtischCoLWebsiteSync/1.0 (public-source verification; https://stammtischbrewery.com/)"
# Deliberately small list. Two distinct news organisations must be checked.
PUBLISHERS = {
    "reuters.com": "Reuters",
    "apnews.com": "Associated Press",
    "bbc.com": "BBC",
    "bbc.co.uk": "BBC",
    "cbc.ca": "CBC",
    "npr.org": "NPR",
    "nytimes.com": "The New York Times",
    "theguardian.com": "The Guardian",
    "washingtonpost.com": "The Washington Post",
    "theglobeandmail.com": "The Globe and Mail",
    "people.com": "People",
    "variety.com": "Variety",
    "hollywoodreporter.com": "The Hollywood Reporter",
    "nbcnews.com": "NBC",
    "cnn.com": "CNN",
    "nba.com": "NBA",
    "latimes.com": "Los Angeles Times",
}

def norm(value):
    s = unicodedata.normalize("NFKD", str(value)).casefold()
    return re.sub(r"[^a-z0-9]+", " ", "".join(x for x in s if not unicodedata.combining(x))).strip()

def source_publisher(url):
    try:
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.username or parsed.password:
            return None
        host = (parsed.hostname or "").lower()
        for root, publisher in PUBLISHERS.items():
            if host == root or host.endswith("." + root):
                return publisher
    except ValueError:
        pass
    return None

def fetch_json(params):
    url = API + "?" + urlencode({**params, "format": "json"})
    request = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise ValueError("Source lookup did not succeed")
        return json.loads(response.read(900000))

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

def article_supports(url, name, death_date):
    """Treat inaccessible pages and dates absent from page content as unverified."""
    if not source_publisher(url):
        return False
    try:
        request = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        # Don't follow editorial redirects to an untrusted origin.
        with build_opener(NoRedirect()).open(request, timeout=9) as response:
            if response.status != 200 or "text/html" not in response.headers.get("Content-Type", ""):
                return False
            raw = response.read(900000).decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return False
    body = unescape(re.sub(r"<[^>]+>", " ", raw))
    normal = norm(body)
    person = norm(name)
    if person not in normal:
        return False
    if not any(term in normal for term in ("died", "death", "passes away", "passed away", "obituary", "has died")):
        return False
    day = date.fromisoformat(death_date)
    formats = (day.strftime("%Y-%m-%d"), day.strftime("%B %d, %Y"),
               day.strftime("%d %B %Y"), day.strftime("%B %d %Y"))
    # Dates may appear as e.g., October 7 vs October 07.
    variants = set(formats)
    for x in formats:
        variants.add(re.sub(r"\b0([1-9])\b", r"\1", x))
    return any(norm(x) in normal for x in variants)

def claim_date(claim):
    try:
        if claim.get("rank") == "deprecated":
            return None
        value = claim["mainsnak"]["datavalue"]["value"]
        if value["precision"] < 11:
            return None
        raw = value["time"]
        if not re.fullmatch(r"\+\d{4}-\d{2}-\d{2}T00:00:00Z", raw):
            return None
        return date.fromisoformat(raw[1:11]).isoformat()
    except (KeyError, ValueError, TypeError):
        return None

def research(name, born, known_on=None):
    """Return one independently corroborated confirmation, or None. No guesses."""
    try:
        candidate_ids = [x["id"] for x in fetch_json({
            "action":"wbsearchentities", "search":name, "language":"en",
            "type":"item", "limit":10}).get("search", []) if norm(x.get("label")) == norm(name)]
        if not candidate_ids:
            return None
        entities = fetch_json({"action":"wbgetentities", "ids":"|".join(candidate_ids),
                               "props":"claims|labels|aliases", "languages":"en"}).get("entities", {})
        for item_id in candidate_ids:
            entity = entities.get(item_id, {})
            labels = [entity.get("labels", {}).get("en", {}).get("value", "")]
            labels += [x.get("value", "") for x in entity.get("aliases", {}).get("en", [])]
            if norm(name) not in {norm(x) for x in labels}:
                continue
            claims = entity.get("claims", {})
            if born not in {claim_date(c) for c in claims.get("P569", [])}:
                continue
            dated = [c for c in claims.get("P570", []) if claim_date(c)]
            if len({claim_date(c) for c in dated}) != 1:
                continue
            actual = claim_date(dated[0])
            if not actual or actual > date.today().isoformat() or actual < born:
                continue
            if known_on and actual > known_on:
                continue  # the group can't have discovered the death before it occurred
            references = []
            for c in dated:
                for ref in c.get("references", []):
                    for snak in ref.get("snaks", {}).get("P854", []):
                        url = snak.get("datavalue", {}).get("value")
                        if isinstance(url, str) and source_publisher(url):
                            references.append(url)
            verified = []
            publishers = set()
            for url in dict.fromkeys(references):
                publisher = source_publisher(url)
                if publisher in publishers:
                    continue
                if article_supports(url, name, actual):
                    verified.append(url)
                    publishers.add(publisher)
                    if len(publishers) == 2:
                        return {"actualDeathDate":actual, "sourceUrl":verified[0],
                                "sourceLabel":"Verified reports: " + " and ".join(sorted(publishers)),
                                "verifiedOn":datetime.now(timezone.utc).date().isoformat(),
                                "evidenceUrls":verified, "evidenceMethod":"Exact Wikidata identity and date, plus two independent articles"}
        return None
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None
