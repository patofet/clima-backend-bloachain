import json
import re
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime

# Configuración de archivos
LOG_FILE = 'blockchain-out.log'  # Asumo que aquí están los logs buenos
OUTPUT_IMAGE = 'grafica_consumo_generacion.png'


def parse_custom_string(data_string):
    """
    Parsea la cadena: 'Consumption_YYYY-MM-DD HH:MM_VALUE_Generation_VAL_...'
    """
    try:
        # Separamos por guión bajo
        parts = data_string.split('_')

        # Estructura esperada basada en tu ejemplo:
        # [0] = "Consumption"
        # [1] = Fecha (2025-11-13)
        # [2] = Hora (10:00)
        # [3] = Valor Consumo (215.18)
        # [4] = "Generation"
        # [5] = Valor Generación (o 'None')

        date_str = f"{parts[1]} {parts[2]}"
        consumption_val = parts[3]
        generation_val = parts[5]  # Asumiendo que es el siguiente valor

        # Convertir fecha
        timestamp = datetime.strptime(date_str, '%Y-%m-%d %H:%M')

        # Convertir consumo
        consumption = float(consumption_val) if consumption_val != 'None' else 0.0

        # Convertir generación (Manejo especial para 'None')
        generation = 0.0
        if generation_val != 'None':
            try:
                generation = float(generation_val)
            except ValueError:
                generation = 0.0

        return {
            'timestamp': timestamp,
            'consumption': consumption,
            'generation': generation
        }
    except Exception as e:
        # Si la línea no cumple el formato exacto, la ignoramos pero imprimimos error leve
        # print(f"Error parseando línea de datos: {e} -> {data_string[:20]}...")
        return None


def extract_data_from_log(filename):
    data_list = []

    # Regex para encontrar el JSON dentro de la linea de log
    # Busca algo que empiece por {"address" y termine en }
    json_pattern = re.compile(r'(\{.*?\})')

    print(f"Leyendo {filename}...")

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            # Buscamos si la línea contiene el patrón JSON
            match = json_pattern.search(line)
            if match:
                json_str = match.group(1)
                try:
                    data_json = json.loads(json_str)

                    # Verificamos que tenga los campos clave
                    if 'description' in data_json and 'Consumption' in data_json['description']:
                        parsed_data = parse_custom_string(data_json['description'])
                        if parsed_data:
                            data_list.append(parsed_data)

                except json.JSONDecodeError:
                    continue

    return pd.DataFrame(data_list)


# --- EJECUCIÓN PRINCIPAL ---

# 1. Extraer datos
df = extract_data_from_log(LOG_FILE)

if df.empty:
    print("⚠ No se encontraron datos válidos. Verifica que el log tenga líneas con 'description' y 'Consumption'.")
    # --- BLOQUE DE PRUEBA (DESCOMENTAR SI QUIERES PROBAR SIN DATOS REALES) ---
    # print("Generando datos de prueba...")
    # df = pd.DataFrame({
    #     'timestamp': pd.date_range(start='2025-11-13 08:00', periods=10, freq='h'),
    #     'consumption': [200, 215.18, 230, 180, 150, 210, 220, 240, 250, 200],
    #     'generation': [0, 0, 10, 50, 120, 130, 80, 20, 0, 0]
    # })
else:
    print(f"✅ Se encontraron {len(df)} registros válidos.")

    # Ordenar por fecha por si acaso vienen desordenados
    df = df.sort_values('timestamp')

    # 2. Configurar la Gráfica (Estilo similar a las imágenes)
    plt.figure(figsize=(12, 6))

    # Graficar Consumo (Línea Azul o Barras según prefieras, aquí uso Línea con área)
    plt.plot(df['timestamp'], df['consumption'], label='Consumo (Wh)', color='#1f77b4', linewidth=2, marker='o',
             markersize=4)
    plt.fill_between(df['timestamp'], df['consumption'], color='#1f77b4', alpha=0.1)

    # Graficar Generación (Línea Verde o Naranja)
    plt.plot(df['timestamp'], df['generation'], label='Generación (Wh)', color='#ff7f0e', linewidth=2, marker='s',
             markersize=4)
    plt.fill_between(df['timestamp'], df['generation'], color='#ff7f0e', alpha=0.1)

    # Formato de fechas en el eje X
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M\n%d-%m'))
    plt.gca().xaxis.set_major_locator(mdates.AutoDateLocator())

    # Títulos y Etiquetas
    plt.title('Monitorización Blockchain: Consumo vs Generación', fontsize=14, fontweight='bold')
    plt.ylabel('Energía (Unidades)', fontsize=12)
    plt.xlabel('Tiempo', fontsize=12)

    # Grid y Leyenda
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.legend(loc='upper right', frameon=True, shadow=True)
    plt.xticks(rotation=45)

    # Ajuste final
    plt.tight_layout()

    # Guardar y Mostrar
    plt.savefig(OUTPUT_IMAGE)
    print(f"✅ Gráfica guardada como: {OUTPUT_IMAGE}")
    plt.show()