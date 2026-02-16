import json
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from datetime import datetime
import numpy as np
from collections import Counter, defaultdict

class BlockchainDataInspector:
    def __init__(self, json_file_path):
        self.json_file_path = json_file_path
        self.data = self.load_data()
        self.valid_entries = self.get_valid_entries()
    
    def load_data(self):
        with open(self.json_file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    
    def get_valid_entries(self):
        return [entry for entry in self.data if entry and 'original_data' in entry and entry['original_data']]
    
    def inspect_data_structure(self):
        """Inspeccionar la estructura real de original_data"""
        print("=== INSPECCIÓN DE ESTRUCTURA DE DATOS ===")
        print(f"Total entradas: {len(self.data)}")
        print(f"Entradas válidas con original_data: {len(self.valid_entries)}")
        
        if self.valid_entries:
            # Analizar estructura del primer elemento válido
            sample = self.valid_entries[0]['original_data']
            print(f"\nEstructura del primer elemento:")
            if isinstance(sample, dict):
                print(f"Claves disponibles: {list(sample.keys())}")
                for key, value in sample.items():
                    print(f"  {key}: {type(value).__name__} - {str(value)[:100]}...")
            
            # Buscar patrones comunes en las claves
            all_keys = set()
            for entry in self.valid_entries[:10]:  # Muestrea los primeros 10
                if isinstance(entry['original_data'], dict):
                    all_keys.update(entry['original_data'].keys())
            
            print(f"\nClaves encontradas en los datos: {sorted(all_keys)}")
    
    def detect_blockchain_patterns(self):
        """Detectar patrones específicos de blockchain en los datos"""
        patterns = {
            'transactions': [],
            'blocks': [],
            'addresses': [],
            'hashes': [],
            'timestamps': [],
            'amounts': [],
            'gas_prices': [],
            'errors': [],
            'contract_calls': []
        }
        
        for entry in self.valid_entries:
            data = entry['original_data']
            if isinstance(data, dict):
                for key, value in data.items():
                    key_lower = str(key).lower()
                    value_str = str(value).lower()
                    
                    # Detectar transacciones
                    if 'tx' in key_lower or 'transaction' in key_lower or 'hash' in key_lower:
                        patterns['transactions'].append(value)
                    
                    # Detectar direcciones (formato típico de ethereum/bitcoin)
                    if len(str(value)) == 42 and str(value).startswith('0x'):
                        patterns['addresses'].append(value)
                    elif len(str(value)) == 64 and all(c in '0123456789abcdef' for c in str(value).lower()):
                        patterns['hashes'].append(value)
                    
                    # Detectar timestamps
                    if 'time' in key_lower or 'timestamp' in key_lower:
                        patterns['timestamps'].append(value)
                    
                    # Detectar montos/valores
                    if any(word in key_lower for word in ['value', 'amount', 'balance', 'eth', 'wei']):
                        patterns['amounts'].append(value)
                    
                    # Detectar gas
                    if 'gas' in key_lower:
                        patterns['gas_prices'].append(value)
                    
                    # Detectar errores
                    if any(word in value_str for word in ['error', 'fail', 'revert', 'invalid']):
                        patterns['errors'].append(value)
                    
                    # Detectar contratos
                    if any(word in key_lower for word in ['contract', 'call', 'method']):
                        patterns['contract_calls'].append(value)
        
        return patterns
    
    def create_transaction_flow_analysis(self):
        """Análisis del flujo de transacciones"""
        patterns = self.detect_blockchain_patterns()
        
        if not patterns['transactions']:
            print("No se detectaron patrones de transacciones claros")
            return
        
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
        
        # 1. Frecuencia de transacciones por tiempo
        if patterns['timestamps']:
            timestamps = [t for t in patterns['timestamps'] if str(t).isdigit()]
            if timestamps:
                ax1.hist(timestamps, bins=30, color='skyblue', edgecolor='black')
                ax1.set_title('Distribución Temporal de Transacciones')
                ax1.set_xlabel('Timestamp')
                ax1.set_ylabel('Frecuencia')
        
        # 2. Distribución de montos/valores
        if patterns['amounts']:
            amounts = []
            for amount in patterns['amounts']:
                try:
                    if isinstance(amount, (int, float)):
                        amounts.append(float(amount))
                    elif str(amount).replace('.', '').isdigit():
                        amounts.append(float(amount))
                except:
                    continue
            
            if amounts:
                ax2.hist(np.log10(np.array(amounts) + 1), bins=30, color='lightgreen', edgecolor='black')
                ax2.set_title('Distribución de Montos (log scale)')
                ax2.set_xlabel('Log10(Monto + 1)')
                ax2.set_ylabel('Frecuencia')
        
        # 3. Top direcciones más activas
        if patterns['addresses']:
            addr_counts = Counter(patterns['addresses'])
            top_addresses = addr_counts.most_common(10)
            if top_addresses:
                addrs, counts = zip(*top_addresses)
                ax3.bar(range(len(addrs)), counts, color='orange')
                ax3.set_title('Top 10 Direcciones Más Activas')
                ax3.set_xlabel('Dirección (índice)')
                ax3.set_ylabel('Número de Transacciones')
                ax3.set_xticks(range(len(addrs)))
                ax3.set_xticklabels([f"...{addr[-6:]}" for addr in addrs], rotation=45)
        
        # 4. Análisis de errores
        error_types = Counter()
        for error in patterns['errors']:
            error_str = str(error).lower()
            if 'revert' in error_str:
                error_types['Revert'] += 1
            elif 'fail' in error_str:
                error_types['Fail'] += 1
            elif 'invalid' in error_str:
                error_types['Invalid'] += 1
            else:
                error_types['Other'] += 1
        
        if error_types:
            labels, counts = zip(*error_types.items())
            ax4.pie(counts, labels=labels, autopct='%1.1f%%', startangle=90)
            ax4.set_title('Distribución de Tipos de Errores')
        
        plt.tight_layout()
        plt.savefig('blockchain_transaction_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def create_gas_efficiency_analysis(self):
        """Análisis de eficiencia de gas"""
        patterns = self.detect_blockchain_patterns()
        
        if not patterns['gas_prices']:
            print("No se detectaron datos de gas")
            return
        
        gas_data = []
        for gas in patterns['gas_prices']:
            try:
                if isinstance(gas, (int, float)):
                    gas_data.append(float(gas))
                elif str(gas).isdigit():
                    gas_data.append(float(gas))
            except:
                continue
        
        if not gas_data:
            return
        
        fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6))
        
        # 1. Distribución de precios de gas
        ax1.hist(gas_data, bins=50, color='purple', alpha=0.7, edgecolor='black')
        ax1.set_title('Distribución de Precios de Gas')
        ax1.set_xlabel('Precio de Gas')
        ax1.set_ylabel('Frecuencia')
        ax1.axvline(np.mean(gas_data), color='red', linestyle='--', label=f'Media: {np.mean(gas_data):.2f}')
        ax1.legend()
        
        # 2. Gas usado a lo largo del tiempo (usando line_number como proxy)
        line_numbers = [entry['line_number'] for entry in self.valid_entries if 'line_number' in entry]
        if len(gas_data) == len(line_numbers[:len(gas_data)]):
            ax2.scatter(line_numbers[:len(gas_data)], gas_data, alpha=0.6, color='blue')
            ax2.set_title('Evolución del Gas a lo Largo del Tiempo')
            ax2.set_xlabel('Número de Línea (Tiempo)')
            ax2.set_ylabel('Gas Usado')
        
        # 3. Box plot para identificar outliers
        ax3.boxplot(gas_data, vert=True)
        ax3.set_title('Análisis de Outliers en Gas')
        ax3.set_ylabel('Precio de Gas')
        ax3.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('gas_efficiency_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def create_network_activity_heatmap(self):
        """Mapa de calor de actividad de red más inteligente"""
        if not self.valid_entries:
            return
        
        # Crear matriz de actividad por hora del día vs día
        activity_matrix = defaultdict(lambda: defaultdict(int))
        
        for entry in self.valid_entries:
            line_num = entry.get('line_number', 0)
            # Simular hora del día y día basado en line_number
            hour = (line_num % 24)
            day = (line_num // 1000) % 7  # Simular días de la semana
            activity_matrix[day][hour] += 1
        
        # Convertir a matriz numpy
        days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
        hours = list(range(24))
        
        matrix_data = []
        for day in range(7):
            row = []
            for hour in range(24):
                row.append(activity_matrix[day][hour])
            matrix_data.append(row)
        
        plt.figure(figsize=(15, 8))
        sns.heatmap(matrix_data, 
                   xticklabels=hours, 
                   yticklabels=days,
                   cmap='YlOrRd', 
                   annot=False,
                   fmt='d',
                   cbar_kws={'label': 'Número de Transacciones'})
        
        plt.title('Mapa de Calor de Actividad de Red\n(Día de la Semana vs Hora del Día)', fontsize=14)
        plt.xlabel('Hora del Día')
        plt.ylabel('Día de la Semana')
        plt.tight_layout()
        plt.savefig('network_activity_heatmap.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def run_practical_analysis(self):
        """Ejecutar todos los análisis prácticos"""
        print("Iniciando análisis práctico de datos blockchain...")
        
        # Primero inspeccionar la estructura
        self.inspect_data_structure()
        
        # Luego crear gráficos útiles
        print("\nGenerando análisis de flujo de transacciones...")
        self.create_transaction_flow_analysis()
        
        print("\nGenerando análisis de eficiencia de gas...")
        self.create_gas_efficiency_analysis()
        
        print("\nGenerando mapa de calor de actividad...")
        self.create_network_activity_heatmap()
        
        print("\nAnálisis completado. Revisa los archivos PNG generados.")

if __name__ == "__main__":
    inspector = BlockchainDataInspector('/Users/jobchain/IdeaProjects/arlab-blockchain/parsed_json_objects.json')
    inspector.run_practical_analysis()
