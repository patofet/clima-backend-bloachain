import json
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from collections import Counter, defaultdict
import numpy as np
from datetime import datetime
import re

class BlockchainDataAnalyzer:
    def __init__(self, json_file_path):
        self.json_file_path = json_file_path
        self.data = self.load_data()
        self.df = self.create_dataframe()
    
    def load_data(self):
        """Cargar datos del archivo JSON"""
        with open(self.json_file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    
    def create_dataframe(self):
        """Crear DataFrame para análisis"""
        valid_entries = [entry for entry in self.data if entry and 'line_number' in entry]
        
        df_data = []
        for entry in valid_entries:
            row = {
                'line_number': entry.get('line_number'),
                'source_file': entry.get('source_file'),
                'has_original_data': 'original_data' in entry and entry['original_data'] is not None
            }
            
            # Analizar original_data si existe
            if entry.get('original_data'):
                original_data = entry['original_data']
                if isinstance(original_data, dict):
                    row.update({
                        'data_keys_count': len(original_data.keys()) if hasattr(original_data, 'keys') else 0,
                        'data_type': 'dict',
                        'data_complexity': self.calculate_complexity(original_data)
                    })
                else:
                    row.update({
                        'data_keys_count': 0,
                        'data_type': type(original_data).__name__,
                        'data_complexity': 1
                    })
            else:
                row.update({
                    'data_keys_count': 0,
                    'data_type': 'empty',
                    'data_complexity': 0
                })
            
            df_data.append(row)
        
        return pd.DataFrame(df_data)
    
    def calculate_complexity(self, data):
        """Calcular complejidad de los datos"""
        if isinstance(data, dict):
            return len(str(data))
        elif isinstance(data, list):
            return len(data)
        else:
            return len(str(data)) if data else 0
    
    def plot_line_number_distribution(self):
        """Gráfico 1: Distribución de números de línea"""
        plt.figure(figsize=(12, 6))
        plt.hist(self.df['line_number'], bins=50, edgecolor='black', alpha=0.7)
        plt.title('Distribución de Entradas por Número de Línea')
        plt.xlabel('Número de Línea')
        plt.ylabel('Frecuencia')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig('line_distribution.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def plot_data_presence_analysis(self):
        """Gráfico 2: Análisis de presencia de datos"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Gráfico de torta - presencia de original_data
        data_presence = self.df['has_original_data'].value_counts()
        ax1.pie(data_presence.values, labels=['Sin Datos', 'Con Datos'], autopct='%1.1f%%', startangle=90)
        ax1.set_title('Presencia de Datos Original')
        
        # Gráfico de barras - tipos de datos
        data_types = self.df['data_type'].value_counts()
        ax2.bar(data_types.index, data_types.values)
        ax2.set_title('Distribución de Tipos de Datos')
        ax2.set_xlabel('Tipo de Dato')
        ax2.set_ylabel('Cantidad')
        ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plt.savefig('data_presence_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def plot_line_clusters(self):
        """Gráfico 3: Análisis de clusters de líneas"""
        plt.figure(figsize=(14, 8))
        
        # Crear bins para agrupar líneas cercanas
        line_numbers = self.df['line_number'].sort_values()
        line_ranges = []
        current_range_start = line_numbers.iloc[0]
        current_range_end = line_numbers.iloc[0]
        
        for line in line_numbers[1:]:
            if line - current_range_end <= 100:  # Si está dentro de 100 líneas
                current_range_end = line
            else:
                line_ranges.append((current_range_start, current_range_end, current_range_end - current_range_start + 1))
                current_range_start = line
                current_range_end = line
        
        # Añadir el último rango
        line_ranges.append((current_range_start, current_range_end, current_range_end - current_range_start + 1))
        
        # Plotear los clusters
        starts, ends, sizes = zip(*line_ranges)
        plt.scatter(starts, sizes, s=[s*10 for s in sizes], alpha=0.6)
        plt.xlabel('Línea de Inicio del Cluster')
        plt.ylabel('Tamaño del Cluster')
        plt.title('Clusters de Actividad en el Archivo de Log')
        plt.grid(True, alpha=0.3)
        
        # Añadir texto para los clusters más grandes
        for i, (start, end, size) in enumerate(line_ranges):
            if size > 10:  # Solo mostrar clusters grandes
                plt.annotate(f'Cluster {i+1}\n({size} entradas)', 
                           (start, size), 
                           xytext=(5, 5), 
                           textcoords='offset points',
                           fontsize=8,
                           bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7))
        
        plt.tight_layout()
        plt.savefig('line_clusters.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def plot_data_complexity_analysis(self):
        """Gráfico 4: Análisis de complejidad de datos"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Histograma de complejidad
        valid_complexity = self.df[self.df['data_complexity'] > 0]['data_complexity']
        ax1.hist(valid_complexity, bins=30, edgecolor='black', alpha=0.7)
        ax1.set_title('Distribución de Complejidad de Datos')
        ax1.set_xlabel('Complejidad (tamaño de datos)')
        ax1.set_ylabel('Frecuencia')
        ax1.grid(True, alpha=0.3)
        
        # Box plot por tipo de datos
        sns.boxplot(data=self.df[self.df['data_complexity'] > 0], 
                   x='data_type', y='data_complexity', ax=ax2)
        ax2.set_title('Complejidad por Tipo de Datos')
        ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plt.savefig('data_complexity.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def plot_timeline_analysis(self):
        """Gráfico 5: Análisis temporal (basado en números de línea como proxy)"""
        plt.figure(figsize=(14, 6))
        
        # Crear ventanas de tiempo basadas en números de línea
        window_size = 1000  # Cada 1000 líneas
        line_min = self.df['line_number'].min()
        line_max = self.df['line_number'].max()
        
        windows = range(line_min, line_max + window_size, window_size)
        activity_per_window = []
        
        for i in range(len(windows) - 1):
            count = len(self.df[(self.df['line_number'] >= windows[i]) & 
                              (self.df['line_number'] < windows[i + 1])])
            activity_per_window.append(count)
        
        plt.plot(windows[:-1], activity_per_window, marker='o', linewidth=2, markersize=4)
        plt.title('Actividad de Validación a lo Largo del Archivo')
        plt.xlabel('Número de Línea (ventanas de 1000)')
        plt.ylabel('Número de Validaciones')
        plt.grid(True, alpha=0.3)
        plt.fill_between(windows[:-1], activity_per_window, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('timeline_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    def generate_summary_report(self):
        """Generar reporte resumen"""
        total_entries = len(self.df)
        valid_data_entries = self.df['has_original_data'].sum()
        
        print("=== REPORTE DE ANÁLISIS DE VALIDACIÓN DE BLOCKCHAIN ===")
        print(f"Total de entradas: {total_entries}")
        print(f"Entradas con datos válidos: {valid_data_entries} ({valid_data_entries/total_entries*100:.1f}%)")
        print(f"Entradas vacías: {total_entries - valid_data_entries} ({(total_entries - valid_data_entries)/total_entries*100:.1f}%)")
        print(f"Rango de líneas: {self.df['line_number'].min()} - {self.df['line_number'].max()}")
        print(f"Complejidad promedio de datos: {self.df[self.df['data_complexity'] > 0]['data_complexity'].mean():.2f}")
        print("\nTipos de datos encontrados:")
        print(self.df['data_type'].value_counts())
    
    def run_complete_analysis(self):
        """Ejecutar análisis completo"""
        print("Iniciando análisis de datos de blockchain...")
        
        self.generate_summary_report()
        print("\nGenerando gráficos...")
        
        self.plot_line_number_distribution()
        self.plot_data_presence_analysis()
        self.plot_line_clusters()
        self.plot_data_complexity_analysis()
        self.plot_timeline_analysis()
        
        print("Análisis completado. Gráficos guardados como PNG.")

# Uso del analizador
if __name__ == "__main__":
    analyzer = BlockchainDataAnalyzer('/Users/jobchain/IdeaProjects/arlab-blockchain/parsed_json_objects.json')
    analyzer.run_complete_analysis()
