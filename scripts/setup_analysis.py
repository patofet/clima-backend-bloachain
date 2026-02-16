import subprocess
import sys

def install_requirements():
    """Instalar las librerías necesarias"""
    packages = [
        'matplotlib',
        'pandas',
        'seaborn',
        'numpy',
        'networkx'
    ]
    
    for package in packages:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
            print(f"✓ {package} instalado correctamente")
        except subprocess.CalledProcessError:
            print(f"✗ Error instalando {package}")

if __name__ == "__main__":
    print("Instalando dependencias para análisis de blockchain...")
    install_requirements()
    print("Instalación completada.")
