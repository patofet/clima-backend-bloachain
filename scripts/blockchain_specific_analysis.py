import json
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from collections import defaultdict, Counter
from datetime import datetime

class BlockchainSpecificAnalyzer:
    def __init__(self, json_file_path):
        self.json_file_path = json_file_path
        self.data = self.load_data()
        self.unified_requests = self.unify_requests()
    
    def load_data(self):
        with open(self.json_file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    
    def unify_requests(self):
        """Unify entries by idOfRequest and calculate metrics"""
        request_groups = defaultdict(list)
        
        # Group entries by idOfRequest
        for entry in self.data:
            if entry and isinstance(entry, dict):
                # Try to extract idOfRequest from different possible locations
                id_request = None
                if 'original_data' in entry:
                    original = entry['original_data']
                    id_request = original.get('idOfRequest') or original.get('id') or original.get('requestId')
                else:
                    id_request = entry.get('idOfRequest') or entry.get('id') or entry.get('requestId')
                
                if id_request:
                    request_groups[id_request].append(entry)
        
        # Unify each group
        unified_requests = []
        for request_id, entries in request_groups.items():
            unified = self.create_unified_request(request_id, entries)
            if unified:
                unified_requests.append(unified)
        
        return unified_requests
    
    def create_unified_request(self, request_id, entries):
        """Create a unified request object from multiple entries"""
        if not entries:
            return None
        
        # Sort entries by line_number to get chronological order
        sorted_entries = sorted(entries, key=lambda x: x.get('line_number', 0))
        
        first_entry = sorted_entries[0]
        last_entry = sorted_entries[-1]
        
        # Calculate processing time
        first_line = first_entry.get('line_number', 0)
        last_line = last_entry.get('line_number', 0)
        processing_time = last_line - first_line
        
        # Extract additional info from original_data
        original_data = first_entry.get('original_data', {})
        
        unified = {
            'request_id': request_id,
            'entry_count': len(entries),
            'processing_time': processing_time,
            'first_line': first_line,
            'last_line': last_line,
            'status': self.extract_status(entries),
            'certificate_type': original_data.get('certificateType', 'unknown'),
            'user_id': original_data.get('userId', 'unknown'),
            'entries': entries,
            'timestamps': [e.get('line_number', 0) for e in sorted_entries]
        }
        
        return unified
    
    def extract_status(self, entries):
        """Extract the final status from entries"""
        for entry in reversed(entries):
            original = entry.get('original_data', {})
            if 'status' in original:
                return original['status']
            if 'state' in original:
                return original['state']
        return 'unknown'
    
    def calculate_certification_response_times(self):
        """Calculate certification response times based on gaps between line_numbers"""
        valid_entries = [e for e in self.data if e and 'line_number' in e]
        
        if len(valid_entries) < 2:
            return []
        
        # Sort by line_number
        sorted_entries = sorted(valid_entries, key=lambda x: x['line_number'])
        
        # Calculate gaps between consecutive entries as response time proxy
        response_times = []
        for i in range(1, len(sorted_entries)):
            gap = sorted_entries[i]['line_number'] - sorted_entries[i-1]['line_number']
            response_times.append(gap)
        
        return response_times
    
    def detect_outliers_multiple_methods(self, data):
        """Detect outliers using multiple methods"""
        data = np.array(data)
        outlier_analysis = {}
        
        # Method 1: IQR (Interquartile Range)
        Q1 = np.percentile(data, 25)
        Q3 = np.percentile(data, 75)
        IQR = Q3 - Q1
        iqr_lower = Q1 - 1.5 * IQR
        iqr_upper = Q3 + 1.5 * IQR
        iqr_outliers = (data < iqr_lower) | (data > iqr_upper)
        
        # Method 2: Extreme percentiles
        p95 = np.percentile(data, 95)
        p99 = np.percentile(data, 99)
        percentile_outliers_95 = data > p95
        percentile_outliers_99 = data > p99
        
        # Method 3: Modified Z-Score (more robust)
        median = np.median(data)
        mad = np.median(np.abs(data - median))
        if mad != 0:
            modified_z_scores = 0.6745 * (data - median) / mad
            modified_zscore_outliers = np.abs(modified_z_scores) > 3.5
        else:
            modified_zscore_outliers = np.zeros(len(data), dtype=bool)
        
        outlier_analysis = {
            'iqr': {
                'outliers': iqr_outliers,
                'count': np.sum(iqr_outliers),
                'threshold': iqr_upper,
                'clean_data': data[~iqr_outliers]
            },
            'percentile_95': {
                'outliers': percentile_outliers_95,
                'count': np.sum(percentile_outliers_95),
                'threshold': p95,
                'clean_data': data[~percentile_outliers_95]
            },
            'percentile_99': {
                'outliers': percentile_outliers_99,
                'count': np.sum(percentile_outliers_99),
                'threshold': p99,
                'clean_data': data[~percentile_outliers_99]
            },
            'modified_zscore': {
                'outliers': modified_zscore_outliers,
                'count': np.sum(modified_zscore_outliers),
                'clean_data': data[~modified_zscore_outliers]
            }
        }
        
        return outlier_analysis
    
    def plot_certification_response_time(self):
        """Simple and clear chart of certification response times"""
        response_times = self.calculate_certification_response_times()
        
        if not response_times:
            print("Not enough data to calculate response times")
            return
        
        # Detect outliers using simple method (95th percentile)
        p95_threshold = np.percentile(response_times, 95)
        clean_data = [t for t in response_times if t <= p95_threshold]
        outliers_removed = len(response_times) - len(clean_data)
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))
        
        # Chart 1: Temporal evolution of response times
        ax1.plot(range(len(clean_data)), clean_data, color='blue', linewidth=1, alpha=0.7)
        
        # Average line
        mean_time = np.mean(clean_data)
        ax1.axhline(y=mean_time, color='red', linestyle='--', linewidth=2, 
                   label=f'Average: {mean_time:.1f} units')
        
        # Performance zones
        p75 = np.percentile(clean_data, 75)
        p90 = np.percentile(clean_data, 90)
        
        ax1.axhline(y=p75, color='orange', linestyle=':', alpha=0.7, 
                   label=f'P75 (Acceptable): {p75:.1f}')
        ax1.axhline(y=p90, color='red', linestyle=':', alpha=0.7, 
                   label=f'P90 (Slow): {p90:.1f}')
        
        ax1.fill_between(range(len(clean_data)), 0, p75, alpha=0.1, color='green', label='Optimal Zone')
        ax1.fill_between(range(len(clean_data)), p75, p90, alpha=0.1, color='yellow', label='Acceptable Zone')
        ax1.fill_between(range(len(clean_data)), p90, max(clean_data), alpha=0.1, color='red', label='Slow Zone')
        
        ax1.set_title(f'Certification Response Times\n({outliers_removed} outliers removed)', 
                     fontsize=14, fontweight='bold')
        ax1.set_xlabel('Certification Number')
        ax1.set_ylabel('Response Time (units)')
        ax1.grid(True, alpha=0.3)
        ax1.legend(loc='upper right')
        
        # Chart 2: Simple histogram
        ax2.hist(clean_data, bins=30, color='skyblue', alpha=0.7, edgecolor='black')
        ax2.axvline(x=mean_time, color='red', linestyle='--', linewidth=2, 
                   label=f'Average: {mean_time:.1f}')
        ax2.axvline(x=np.median(clean_data), color='green', linestyle='--', linewidth=2, 
                   label=f'Median: {np.median(clean_data):.1f}')
        
        ax2.set_title('Response Time Distribution')
        ax2.set_xlabel('Response Time (units)')
        ax2.set_ylabel('Frequency')
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        plt.tight_layout()
        plt.savefig('certification_response_times_simple.png', dpi=300, bbox_inches='tight')
        plt.show()
        
        # Simple and clear statistics
        print(f"\n{'='*50}")
        print("CERTIFICATION RESPONSE TIME SUMMARY")
        print(f"{'='*50}")
        print(f"Total certifications analyzed: {len(clean_data):,}")
        print(f"Outliers removed: {outliers_removed:,}")
        print(f"")
        print(f"⏱️  STATISTICS:")
        print(f"   Average time: {np.mean(clean_data):.1f} units")
        print(f"   Median time: {np.median(clean_data):.1f} units")
        print(f"   Minimum time: {np.min(clean_data):.1f} units")
        print(f"   Maximum time: {np.max(clean_data):.1f} units")
        print(f"")
        print(f"🎯 PERFORMANCE THRESHOLDS:")
        print(f"   🟢 Excellent: ≤ {np.percentile(clean_data, 25):.0f} units")
        print(f"   🟡 Acceptable: ≤ {np.percentile(clean_data, 75):.0f} units")
        print(f"   🟠 Slow: ≤ {np.percentile(clean_data, 90):.0f} units")
        print(f"   🔴 Very slow: > {np.percentile(clean_data, 90):.0f} units")
        print(f"")
        print(f"📊 DISTRIBUTION:")
        excellent_count = sum(1 for t in clean_data if t <= np.percentile(clean_data, 25))
        acceptable_count = sum(1 for t in clean_data if np.percentile(clean_data, 25) < t <= np.percentile(clean_data, 75))
        slow_count = sum(1 for t in clean_data if np.percentile(clean_data, 75) < t <= np.percentile(clean_data, 90))
        very_slow_count = sum(1 for t in clean_data if t > np.percentile(clean_data, 90))
        
        print(f"   Excellent: {excellent_count:,} ({excellent_count/len(clean_data)*100:.1f}%)")
        print(f"   Acceptable: {acceptable_count:,} ({acceptable_count/len(clean_data)*100:.1f}%)")
        print(f"   Slow: {slow_count:,} ({slow_count/len(clean_data)*100:.1f}%)")
        print(f"   Very slow: {very_slow_count:,} ({very_slow_count/len(clean_data)*100:.1f}%)")
    
    def plot_request_analysis(self):
        """Create comprehensive visualization of unified requests"""
        if not self.unified_requests:
            print("No unified requests found")
            return
        
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle('Unified Request Analysis Dashboard', fontsize=16, fontweight='bold')
        
        # 1. Processing Time Distribution
        processing_times = [req['processing_time'] for req in self.unified_requests if req['processing_time'] > 0]
        
        if processing_times:
            # Remove extreme outliers for better visualization
            p95 = np.percentile(processing_times, 95)
            clean_times = [t for t in processing_times if t <= p95]
            
            axes[0,0].hist(clean_times, bins=30, color='skyblue', alpha=0.7, edgecolor='black')
            axes[0,0].axvline(np.mean(clean_times), color='red', linestyle='--', 
                             label=f'Average: {np.mean(clean_times):.1f}')
            axes[0,0].axvline(np.median(clean_times), color='green', linestyle='--', 
                             label=f'Median: {np.median(clean_times):.1f}')
            axes[0,0].set_title('Request Processing Time Distribution')
            axes[0,0].set_xlabel('Processing Time (line gaps)')
            axes[0,0].set_ylabel('Frequency')
            axes[0,0].legend()
            axes[0,0].grid(True, alpha=0.3)
        
        # 2. Entry Count per Request
        entry_counts = [req['entry_count'] for req in self.unified_requests]
        axes[0,1].hist(entry_counts, bins=min(20, max(entry_counts)), color='lightgreen', 
                      alpha=0.7, edgecolor='black')
        axes[0,1].set_title('Number of Entries per Request')
        axes[0,1].set_xlabel('Entry Count')
        axes[0,1].set_ylabel('Number of Requests')
        axes[0,1].grid(True, alpha=0.3)
        
        # 3. Certificate Types Distribution
        cert_types = [req['certificate_type'] for req in self.unified_requests]
        cert_counter = Counter(cert_types)
        
        if len(cert_counter) > 1:
            axes[0,2].pie(cert_counter.values(), labels=cert_counter.keys(), autopct='%1.1f%%')
            axes[0,2].set_title('Certificate Types Distribution')
        else:
            axes[0,2].bar(cert_counter.keys(), cert_counter.values(), color='orange', alpha=0.7)
            axes[0,2].set_title('Certificate Types Distribution')
            axes[0,2].set_ylabel('Count')
        
        # 4. Status Distribution
        statuses = [req['status'] for req in self.unified_requests]
        status_counter = Counter(statuses)
        
        colors = ['green' if 'success' in status.lower() or 'complete' in status.lower() 
                 else 'red' if 'error' in status.lower() or 'fail' in status.lower()
                 else 'orange' for status in status_counter.keys()]
        
        axes[1,0].bar(status_counter.keys(), status_counter.values(), color=colors, alpha=0.7)
        axes[1,0].set_title('Request Status Distribution')
        axes[1,0].set_xlabel('Status')
        axes[1,0].set_ylabel('Count')
        axes[1,0].tick_params(axis='x', rotation=45)
        
        # 5. Processing Time vs Entry Count Correlation
        if processing_times and entry_counts:
            valid_requests = [(req['processing_time'], req['entry_count']) 
                            for req in self.unified_requests if req['processing_time'] > 0]
            
            if valid_requests:
                proc_times, ent_counts = zip(*valid_requests)
                axes[1,1].scatter(ent_counts, proc_times, alpha=0.6, color='purple')
                
                # Add trend line
                z = np.polyfit(ent_counts, proc_times, 1)
                p = np.poly1d(z)
                axes[1,1].plot(ent_counts, p(ent_counts), "r--", alpha=0.8)
                
                axes[1,1].set_title('Processing Time vs Entry Count')
                axes[1,1].set_xlabel('Entry Count')
                axes[1,1].set_ylabel('Processing Time')
                axes[1,1].grid(True, alpha=0.3)
        
        # 6. Timeline of Request Initiation
        first_lines = [req['first_line'] for req in self.unified_requests]
        if first_lines:
            axes[1,2].plot(sorted(first_lines), range(len(first_lines)), 'b-', alpha=0.7)
            axes[1,2].set_title('Request Initiation Timeline')
            axes[1,2].set_xlabel('Line Number (Time Proxy)')
            axes[1,2].set_ylabel('Cumulative Requests')
            axes[1,2].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('unified_requests_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
        
        # Print summary statistics
        self.print_request_statistics()
    
    def print_request_statistics(self):
        """Print detailed statistics about unified requests"""
        print("\n" + "="*60)
        print("UNIFIED REQUESTS ANALYSIS SUMMARY")
        print("="*60)
        
        total_requests = len(self.unified_requests)
        total_entries = sum(req['entry_count'] for req in self.unified_requests)
        
        print(f"📊 GENERAL STATISTICS:")
        print(f"   Total unique requests: {total_requests:,}")
        print(f"   Total entries processed: {total_entries:,}")
        print(f"   Average entries per request: {total_entries/total_requests:.1f}")
        
        # Processing times
        processing_times = [req['processing_time'] for req in self.unified_requests if req['processing_time'] > 0]
        if processing_times:
            print(f"\n⏱️  PROCESSING TIME ANALYSIS:")
            print(f"   Average processing time: {np.mean(processing_times):.1f}")
            print(f"   Median processing time: {np.median(processing_times):.1f}")
            print(f"   Min processing time: {min(processing_times):.1f}")
            print(f"   Max processing time: {max(processing_times):.1f}")
            print(f"   95th percentile: {np.percentile(processing_times, 95):.1f}")
        
        # Certificate types
        cert_types = Counter(req['certificate_type'] for req in self.unified_requests)
        print(f"\n📜 CERTIFICATE TYPES:")
        for cert_type, count in cert_types.most_common():
            percentage = (count / total_requests) * 100
            print(f"   {cert_type}: {count:,} ({percentage:.1f}%)")
        
        # Status analysis
        statuses = Counter(req['status'] for req in self.unified_requests)
        print(f"\n📈 STATUS DISTRIBUTION:")
        for status, count in statuses.most_common():
            percentage = (count / total_requests) * 100
            print(f"   {status}: {count:,} ({percentage:.1f}%)")
        
        # Performance insights
        print(f"\n💡 PERFORMANCE INSIGHTS:")
        if processing_times:
            fast_requests = len([t for t in processing_times if t <= np.percentile(processing_times, 25)])
            slow_requests = len([t for t in processing_times if t >= np.percentile(processing_times, 75)])
            print(f"   Fast requests (P25): {fast_requests:,} ({fast_requests/len(processing_times)*100:.1f}%)")
            print(f"   Slow requests (P75): {slow_requests:,} ({slow_requests/len(processing_times)*100:.1f}%)")
        
        # Find requests with most entries (potential issues)
        max_entries = max(req['entry_count'] for req in self.unified_requests)
        complex_requests = [req for req in self.unified_requests if req['entry_count'] >= max_entries * 0.8]
        if complex_requests:
            print(f"   Complex requests (≥{max_entries * 0.8:.0f} entries): {len(complex_requests)}")

# Usage
if __name__ == "__main__":
    analyzer = BlockchainSpecificAnalyzer('/Users/jobchain/IdeaProjects/arlab-blockchain/parsed_json_objects.json')
    print(f"Data loaded: {len(analyzer.data)} entries")
    print(f"Unified into: {len(analyzer.unified_requests)} unique requests")
    analyzer.plot_request_analysis()
