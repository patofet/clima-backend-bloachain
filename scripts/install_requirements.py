import subprocess
import sys

def install_package(package):
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
        print(f"✅ {package} instalado correctamente")
    except subprocess.CalledProcessError:
        print(f"❌ Error instalando {package}")

def main():
    packages = [
        'matplotlib',
        'pandas', 
        'numpy',
        'scipy',
        'seaborn'
    ]
    
    print("🚀 Instalando dependencias para análisis de blockchain...")
    for package in packages:
        install_package(package)
    print("\n✅ Instalación completada. Ahora puedes ejecutar el análisis.")

if __name__ == "__main__":
    main()
