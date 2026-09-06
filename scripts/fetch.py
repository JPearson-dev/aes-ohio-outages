#!/usr/bin/env python3
"""
AES Ohio Outage Data Scraper

Fetches and normalizes power outage data from the AES Ohio public map XML endpoint.
Produces deterministic, git-diff-friendly JSON files, an append-only heartbeat CSV,
and saves the latest raw XML.
"""

import argparse
import csv
from datetime import datetime
import json
from pathlib import Path
import shutil
import sys
import urllib.request
import xml.etree.ElementTree as ET

DEFAULT_URL = "https://myprofile.aes-ohio.com/DATA/DPLOMSDATA.xml"
USER_AGENT = "Mozilla/5.0 (AES-Ohio-Outage-Tracker; +https://github.com/JPearson-dev/aes-ohio-outages)"


def parse_datetime(dt_str, date_format="%m/%d/%Y %I:%M %p"):
    """Attempts to parse a datetime string into ISO 8601 format."""
    if not dt_str or dt_str.strip().lower() == "null":
        return None
    cleaned = dt_str.strip()
    try:
        dt = datetime.strptime(cleaned, date_format)
        return dt.isoformat()
    except ValueError:
        try:
            dt = datetime.strptime(cleaned, "%m/%d/%Y %I:%M:%S %p")
            return dt.isoformat()
        except ValueError:
            return cleaned


def to_datetime(val):
    """Converts an ISO string or raw date string into a datetime object for comparison."""
    if not val:
        return None
    cleaned = val.strip()
    formats = (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
    )
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(cleaned)
    except Exception:
        return None


def clean_str(val):
    """Cleans a string, returning None for empty or literal 'null' strings."""
    if val is None:
        return None
    s = val.strip()
    if not s or s.lower() == "null":
        return None
    return s


def fetch_xml(url):
    """Fetches raw XML bytes from the given URL."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def ensure_readme(out_path):
    """Ensures a README.md exists in the target data directory, copying from template if needed."""
    readme_path = out_path / "README.md"
    if not readme_path.exists():
        script_dir = Path(__file__).resolve().parent
        template_path = script_dir.parent / "templates" / "data-branch-README.md"
        if template_path.exists():
            shutil.copyfile(template_path, readme_path)


def process_data(xml_bytes, out_dir):
    """Parses XML and writes files to out_dir/current and out_dir/heartbeat.csv."""
    out_path = Path(out_dir)
    current_path = out_path / "current"
    current_path.mkdir(parents=True, exist_ok=True)

    # Ensure README.md exists in data directory
    ensure_readme(out_path)

    # 1. Save raw XML in current/
    latest_xml_path = current_path / "latest.xml"
    with open(latest_xml_path, "wb") as f:
        f.write(xml_bytes)

    # 2. Parse XML content
    root = ET.fromstring(xml_bytes)

    # Parse Markers (Incidents)
    markers = []
    for m in root.findall("Markers"):
        inc_id_raw = m.findtext("INCIDENTID")
        try:
            inc_id = int(inc_id_raw)
        except (TypeError, ValueError):
            inc_id = clean_str(inc_id_raw)

        lat_raw = m.findtext("LAT")
        lng_raw = m.findtext("LNG")
        custs_raw = m.findtext("TOTALCUSTS")

        marker = {
            "id": inc_id,
            "lat": float(lat_raw) if lat_raw else None,
            "lng": float(lng_raw) if lng_raw else None,
            "customers_affected": int(custs_raw) if custs_raw else 0,
            "county": clean_str(m.findtext("COUNTY")),
            "indicator": clean_str(m.findtext("IND")),
            "outage_time": parse_datetime(m.findtext("OutageTime")),
            "estimate_time": parse_datetime(m.findtext("EstimateTime")),
        }
        markers.append(marker)

    # Sort deterministically by incident ID
    markers.sort(key=lambda x: x["id"] if isinstance(x["id"], int) else str(x["id"]))

    incidents_path = current_path / "incidents.json"
    with open(incidents_path, "w", encoding="utf-8") as f:
        json.dump(markers, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Parse Counties
    counties = []
    for c in root.findall("Counties"):
        tot_out_raw = c.findtext("TotOut")
        counties.append({
            "county": clean_str(c.findtext("County")),
            "customers_affected": int(tot_out_raw) if tot_out_raw else 0,
        })
    counties.sort(key=lambda x: x["county"] or "")

    counties_path = current_path / "counties.json"
    with open(counties_path, "w", encoding="utf-8") as f:
        json.dump(counties, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Parse Message / Metadata
    msg_elem = root.find("Message")
    if msg_elem is not None:
        total_out_raw = msg_elem.findtext("TotalOut")
        try:
            total_out = int(total_out_raw)
        except (TypeError, ValueError):
            total_out = 0

        raw_outage_at = clean_str(msg_elem.findtext("Outageat"))
        iso_outage_at = parse_datetime(raw_outage_at, "%m/%d/%Y %I:%M:%S %p")

        status_data = {
            "updated_at": iso_outage_at,
            "updated_at_raw": raw_outage_at,
            "total_customers_affected": total_out,
            "incident_count": len(markers),
            "utility_message": clean_str(msg_elem.findtext("UMessage")),
            "utility_message_time": parse_datetime(msg_elem.findtext("UMTime")),
        }
    else:
        status_data = {
            "updated_at": None,
            "updated_at_raw": None,
            "total_customers_affected": sum(m["customers_affected"] for m in markers),
            "incident_count": len(markers),
            "utility_message": None,
            "utility_message_time": None,
        }

    status_path = current_path / "status.json"
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Append to heartbeat.csv only if new timestamp is strictly newer (monotonicity check)
    heartbeat_path = out_path / "heartbeat.csv"
    ts_for_heartbeat = status_data["updated_at"] or status_data["updated_at_raw"] or datetime.utcnow().isoformat()
    total_out_for_heartbeat = status_data["total_customers_affected"]
    incident_count_for_heartbeat = len(markers)

    last_logged_ts = None
    if heartbeat_path.exists():
        with open(heartbeat_path, "r", encoding="utf-8") as f:
            reader = list(csv.reader(f))
            if len(reader) > 1 and reader[-1]:
                last_logged_ts = reader[-1][0]

    current_dt = to_datetime(ts_for_heartbeat)
    last_logged_dt = to_datetime(last_logged_ts)

    should_append = False
    if last_logged_ts is None:
        should_append = True
    elif current_dt and last_logged_dt:
        if current_dt > last_logged_dt:
            should_append = True
        else:
            print(f"Skipping heartbeat append: {ts_for_heartbeat} is not newer than latest log ({last_logged_ts}).")
    elif ts_for_heartbeat != last_logged_ts:
        should_append = True

    if should_append:
        file_is_new = not heartbeat_path.exists()
        with open(heartbeat_path, "a", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            if file_is_new:
                writer.writerow(["timestamp", "total_customers_affected", "incident_count"])
            writer.writerow([ts_for_heartbeat, total_out_for_heartbeat, incident_count_for_heartbeat])
        print(f"Appended heartbeat entry: {ts_for_heartbeat}")

    print(f"Successfully processed {len(markers)} incidents across {len(counties)} counties.")
    print(f"Total customers affected: {status_data['total_customers_affected']}")
    print(f"Files written to {out_path.resolve()}:")
    print(" - heartbeat.csv")
    print(" - current/latest.xml")
    print(" - current/incidents.json")
    print(" - current/counties.json")
    print(" - current/status.json")


def main():
    parser = argparse.ArgumentParser(description="Fetch and parse AES Ohio outage map data.")
    parser.add_argument("--sample", type=str, help="Path to a local XML sample file instead of fetching live.")
    parser.add_argument("--url", type=str, default=DEFAULT_URL, help=f"Source URL (default: {DEFAULT_URL}).")
    parser.add_argument("--out-dir", type=str, default=None, help="Output directory for generated files.")
    args = parser.parse_args()

    # Determine out_dir: default to ./test-output if running with --sample to protect production data
    if args.out_dir:
        out_dir = args.out_dir
    elif args.sample:
        out_dir = "./test-output"
        print(f"Notice: No --out-dir specified with --sample; defaulting to '{out_dir}' to avoid modifying production data.")
    else:
        out_dir = "."

    if args.sample:
        sample_path = Path(args.sample)
        if not sample_path.exists():
            print(f"Error: Sample file '{args.sample}' does not exist.", file=sys.stderr)
            sys.exit(1)
        print(f"Reading from sample: {sample_path}")
        with open(sample_path, "rb") as f:
            xml_bytes = f.read()
    else:
        print(f"Fetching from URL: {args.url}")
        try:
            xml_bytes = fetch_xml(args.url)
        except Exception as e:
            print(f"Error fetching data: {e}", file=sys.stderr)
            sys.exit(1)

    process_data(xml_bytes, out_dir)


if __name__ == "__main__":
    main()
