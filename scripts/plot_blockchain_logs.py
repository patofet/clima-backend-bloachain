#!/usr/bin/env python3
# Script: Analiza logs con JSON embebido y genera grafica_blockchain.png

import argparse
import json
import re
import sys
import os
from typing import Optional, Any, Dict, List
from pathlib import Path
from collections import defaultdict

# Check dependencies early
try:
    import pandas as pd
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    import numpy as np
except ImportError as e:
    print(f"Error: Missing required dependency: {e}")
    print("Please install dependencies by running:")
    print("  pip3 install -r requirements.txt")
    print("Or use the VS Code task: 'Install Python Dependencies'")
    sys.exit(1)

# Use absolute paths relative to script location
SCRIPT_DIR = Path(__file__).parent.absolute()
LOG_FILES = [
    SCRIPT_DIR.parent / "logs" / "blockchain-out.log",
    SCRIPT_DIR.parent / "logs" / "blockchain-error.log",
]

# Improved JSON regex to handle various formats including embedded JSON
JSON_RE = re.compile(r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})')


def try_parse_json_from_line(line: str) -> List[Dict[str, Any]]:
    found = []
    
    # Clean the line - remove timestamp prefixes and other log formatting
    cleaned_line = line.strip()
    
    # Try to find JSON objects within the line using regex
    for m in JSON_RE.findall(cleaned_line):
        try:
            obj = json.loads(m)
            if isinstance(obj, dict):
                found.append(obj)
        except Exception:
            continue
    
    # If no JSON found with regex, try to extract everything after common prefixes
    if not found:
        # Look for patterns like "timestamp: {json}" or "level: {json}"
        patterns = [
            r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}:\s*(\{.*\})$',  # "2025-10-24 16:00:57: {json}"
            r'^.*?:\s*(\{.*\})$',  # "anything: {json}"
            r'^.*?\s(\{.*\})$',    # "anything {json}"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, cleaned_line)
            if match:
                try:
                    obj = json.loads(match.group(1))
                    if isinstance(obj, dict):
                        found.append(obj)
                        break
                except Exception:
                    continue
    
    return found


def extract_value(d: Dict[str, Any], keys: List[str]) -> Optional[Any]:
    for k in keys:
        if k in d:
            return d[k]
    return None


def parse_timestamp(ts_raw: Any) -> Optional[pd.Timestamp]:
    try:
        if ts_raw is None:
            return None
        # numérico: epoch segundos o milisegundos
        if isinstance(ts_raw, (int, float)):
            # Improved millisecond detection
            if ts_raw > 1e12:  # definitely milliseconds
                return pd.to_datetime(int(ts_raw), unit="ms")
            elif ts_raw > 1e9:  # likely seconds (after year 2001)
                return pd.to_datetime(float(ts_raw), unit="s")
            else:  # might be seconds from a different epoch
                return pd.to_datetime(float(ts_raw), unit="s")
        # str: delegar a pandas (ISO, RFC, etc.)
        if isinstance(ts_raw, str):
            return pd.to_datetime(ts_raw, errors="coerce")
    except Exception as e:
        print(f"Error parsing timestamp {ts_raw}: {e}")
        return None
    return None


def to_float(val: Any) -> Optional[float]:
    try:
        if val is None:
            return None
        return float(val)
    except Exception:
        return None


def parse_all_json_from_logs(log_paths: List[Path]) -> List[Dict[str, Any]]:
    """
    First stage: Parse all JSON objects from log files and return them as an array
    """
    all_json_objects = []
    files_found = 0
    
    for path in log_paths:
        if not path.exists():
            print(f"Warning: Log file not found: {path}")
            continue
            
        files_found += 1
        print(f"Processing log file: {path}")
        
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                line_count = 0
                json_count = 0
                
                for line in f:
                    line_count += 1
                    json_objs = try_parse_json_from_line(line)
                    
                    for obj in json_objs:
                        json_count += 1
                        # Add metadata about source
                        obj_with_meta = {
                            "source_file": str(path),
                            "line_number": line_count,
                            "original_data": obj
                        }
                        all_json_objects.append(obj_with_meta)
                        
                        # Debug: print first few JSON objects to see structure
                        if json_count <= 3:
                            print(f"  Sample JSON {json_count}: {obj}")
                
                print(f"Processed {line_count} lines, found {json_count} JSON objects from {path}")
        except Exception as e:
            print(f"Error reading file {path}: {e}")
            continue
    
    if files_found == 0:
        print("Error: No log files found!")
        return []
        
    print(f"Total JSON objects found: {len(all_json_objects)}")
    return all_json_objects


def parse_logs(log_paths: List[Path]) -> pd.DataFrame:
    """
    Second stage: Convert JSON objects to structured DataFrame for plotting
    """
    # First, get all JSON objects
    all_json_objects = parse_all_json_from_logs(log_paths)
    
    if not all_json_objects:
        return pd.DataFrame(columns=["timestamp", "consumption", "generation"])
    
    # Now process them into structured data
    rows = []
    valid_data_count = 0
    
    for item in all_json_objects:
        obj = item["original_data"]
        
        # intentar extraer campos comunes (variantes de clave)
        ts_raw = extract_value(obj, ["timestamp", "time", "ts", "date", "createdAt", "updatedAt"])
        cons_raw = extract_value(obj, ["consumption", "cons", "consumed", "totalDurationMs", "duration"])
        gen_raw = extract_value(obj, ["generation", "generation_value", "gen", "generated"])
        
        # If we don't find consumption/generation, maybe the JSON has other numeric fields
        if cons_raw is None and gen_raw is None:
            # Look for any numeric fields that might represent data
            for key, value in obj.items():
                if isinstance(value, (int, float)) and key not in ["timestamp", "time", "ts"]:
                    if cons_raw is None:
                        cons_raw = value
                    elif gen_raw is None:
                        gen_raw = value
                    break
        
        ts = parse_timestamp(ts_raw)
        cons = to_float(cons_raw)
        gen = to_float(gen_raw)
        
        if ts is None or (cons is None and gen is None):
            continue
            
        valid_data_count += 1
        rows.append({
            "timestamp": ts, 
            "consumption": cons, 
            "generation": gen,
            "source_file": item["source_file"],
            "line_number": item["line_number"]
        })
    
    print(f"Converted {valid_data_count} JSON objects to valid data points")
    
    if not rows:
        print("Warning: No valid data found in any JSON objects")
        return pd.DataFrame(columns=["timestamp", "consumption", "generation"])
    
    df = pd.DataFrame(rows)
    # Normalizar: asegurar tipos y ordenar
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])
    df["consumption"] = pd.to_numeric(df["consumption"], errors="coerce")
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


def plot_time_series(df: pd.DataFrame, out_path: Path):
    if df.empty:
        print("No hay datos válidos para graficar.")
        return
    
    # Ensure output directory exists
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    fig, ax = plt.subplots(figsize=(12, 6))
    x = df["timestamp"]

    if "consumption" in df.columns and df["consumption"].notna().any():
        ax.plot(x, df["consumption"], color="tab:blue", label="Consumption")
        ax.fill_between(x, df["consumption"].fillna(0), color="tab:blue", alpha=0.15)

    if "generation" in df.columns and df["generation"].notna().any():
        ax.plot(x, df["generation"], color="#ff7f0e", label="Generation")
        ax.fill_between(x, df["generation"].fillna(0), color="#ff7f0e", alpha=0.15)

    ax.set_xlabel("Time")
    ax.set_ylabel("Value")
    ax.set_title("Blockchain: Consumption vs Generation")
    ax.legend()
    ax.grid(True)

    # formato legible en eje X
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(mdates.AutoDateLocator()))
    fig.autofmt_xdate(rotation=15)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"Gráfica guardada en: {out_path}")


def create_unified_requests(all_json: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Group JSON objects by idOfRequest and create unified request objects
    """
    print("\n=== Creating unified requests by idOfRequest ===")
    
    request_groups = defaultdict(list)
    entries_without_id = 0
    
    # Group entries by idOfRequest
    for entry in all_json:
        if not entry or 'original_data' not in entry:
            continue
            
        original = entry['original_data']
        
        # Try to extract idOfRequest from different possible locations
        id_request = None
        if isinstance(original, dict):
            id_request = (original.get('idOfRequest') or 
                         original.get('id') or 
                         original.get('requestId') or
                         original.get('request_id'))
        
        if id_request:
            request_groups[str(id_request)].append(entry)
        else:
            entries_without_id += 1
    
    print(f"Found {len(request_groups)} unique request IDs")
    print(f"Entries without ID: {entries_without_id}")
    
    # Create unified request objects
    unified_requests = []
    for request_id, entries in request_groups.items():
        if not entries:
            continue
            
        # Sort entries by line_number to get chronological order
        sorted_entries = sorted(entries, key=lambda x: x.get('line_number', 0))
        
        first_entry = sorted_entries[0]
        last_entry = sorted_entries[-1]
        
        # Calculate processing time based on line number gaps
        first_line = first_entry.get('line_number', 0)
        last_line = last_entry.get('line_number', 0)
        processing_time = last_line - first_line
        
        # Extract additional info from original_data
        original_data = first_entry.get('original_data', {})
        
        # Try to determine status from the last entry
        status = 'unknown'
        for entry in reversed(sorted_entries):
            original = entry.get('original_data', {})
            if isinstance(original, dict):
                found_status = (original.get('status') or 
                              original.get('state') or
                              original.get('result'))
                if found_status:
                    status = str(found_status)
                    break
        
        # Extract certificate type
        certificate_type = 'unknown'
        for entry in sorted_entries:
            original = entry.get('original_data', {})
            if isinstance(original, dict):
                cert_type = (original.get('certificateType') or
                           original.get('certificate_type') or
                           original.get('type'))
                if cert_type:
                    certificate_type = str(cert_type)
                    break
        
        # Extract user ID
        user_id = 'unknown'
        for entry in sorted_entries:
            original = entry.get('original_data', {})
            if isinstance(original, dict):
                uid = (original.get('userId') or
                      original.get('user_id') or
                      original.get('user'))
                if uid:
                    user_id = str(uid)
                    break
        
        # Create unified request object
        unified_request = {
            'request_id': request_id,
            'entry_count': len(entries),
            'processing_time': processing_time,
            'first_line': first_line,
            'last_line': last_line,
            'status': status,
            'certificate_type': certificate_type,
            'user_id': user_id,
            'first_timestamp': first_entry.get('original_data', {}).get('timestamp'),
            'last_timestamp': last_entry.get('original_data', {}).get('timestamp'),
            'source_files': list(set(entry.get('source_file', 'unknown') for entry in entries)),
            'line_numbers': [entry.get('line_number', 0) for entry in sorted_entries],
            'entries': entries  # Keep all original entries for reference
        }
        
        unified_requests.append(unified_request)
    
    # Sort by processing time (most complex requests first)
    unified_requests.sort(key=lambda x: x['processing_time'], reverse=True)
    
    print(f"Created {len(unified_requests)} unified request objects")
    
    # Print some statistics
    if unified_requests:
        processing_times = [req['processing_time'] for req in unified_requests if req['processing_time'] > 0]
        entry_counts = [req['entry_count'] for req in unified_requests]
        
        print(f"\nRequest Statistics:")
        print(f"  Average processing time: {np.mean(processing_times):.1f}" if processing_times else "  No processing time data")
        print(f"  Average entries per request: {np.mean(entry_counts):.1f}")
        print(f"  Most complex request: {max(entry_counts)} entries")
        print(f"  Simplest request: {min(entry_counts)} entries")
        
        # Show top 5 most complex requests
        print(f"\nTop 5 Most Complex Requests:")
        for i, req in enumerate(unified_requests[:5]):
            print(f"  {i+1}. ID: {req['request_id'][:20]}... - {req['entry_count']} entries - Processing time: {req['processing_time']}")
    
    return unified_requests


def main():
    print("Starting blockchain log analysis...")
    
    # Verify dependencies are working
    try:
        pd.DataFrame()  # Test pandas
        plt.figure()    # Test matplotlib
        plt.close('all')
        print("Dependencies OK")
    except Exception as e:
        print(f"Error with dependencies: {e}")
        print("Please reinstall dependencies: pip3 install -r requirements.txt")
        sys.exit(1)
    
    print(f"Looking for log files in: {[str(p) for p in LOG_FILES]}")
    
    # Stage 1: Parse all JSON objects
    print("\n=== STAGE 1: Parsing JSON objects ===")
    all_json = parse_all_json_from_logs(LOG_FILES)
    
    if not all_json:
        print("No JSON objects found. Exiting.")
        sys.exit(1)
    
    print(f"\nSuccessfully parsed {len(all_json)} JSON objects")
    
    # Save all JSON to a file for inspection
    json_output_file = SCRIPT_DIR.parent / "parsed_json_objects.json"
    try:
        with open(json_output_file, 'w') as f:
            json.dump(all_json, f, indent=2, default=str)
        print(f"All JSON objects saved to: {json_output_file}")
    except Exception as e:
        print(f"Warning: Could not save JSON objects: {e}")
    
    # Stage 1.5: Create unified requests by idOfRequest
    unified_requests = create_unified_requests(all_json)
    
    # Save unified requests to a separate file
    unified_output_file = SCRIPT_DIR.parent / "unified_requests.json"
    try:
        with open(unified_output_file, 'w') as f:
            json.dump(unified_requests, f, indent=2, default=str)
        print(f"Unified requests saved to: {unified_output_file}")
    except Exception as e:
        print(f"Warning: Could not save unified requests: {e}")
    
    # Also create a summary file without the full entries (lighter weight)
    unified_summary_file = SCRIPT_DIR.parent / "unified_requests_summary.json"
    try:
        summary_requests = []
        for req in unified_requests:
            summary_req = {k: v for k, v in req.items() if k != 'entries'}
            summary_requests.append(summary_req)
        
        with open(unified_summary_file, 'w') as f:
            json.dump(summary_requests, f, indent=2, default=str)
        print(f"Unified requests summary saved to: {unified_summary_file}")
    except Exception as e:
        print(f"Warning: Could not save unified requests summary: {e}")
    
    # Stage 2: Convert to DataFrame and plot
    print("\n=== STAGE 2: Converting to structured data ===")
    df = parse_logs(LOG_FILES)
    
    if df.empty:
        print("No plottable data found.")
        return
    
    out_file = SCRIPT_DIR.parent / "grafica_blockchain.png"
    plot_time_series(df, out_file)


if __name__ == "__main__":
    main()
