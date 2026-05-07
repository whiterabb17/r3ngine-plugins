import os
import shutil
import zipfile
import subprocess
import sys

def build_plugin(plugin_slug):
    root_dir = os.path.dirname(os.path.abspath(__file__))
    plugin_dir = os.path.join(root_dir, plugin_slug)
    
    if not os.path.exists(plugin_dir):
        print(f"Error: Plugin directory {plugin_slug} not found.")
        return

    print(f"--- Building plugin: {plugin_slug} ---")
    
    # 1. Build UI if it exists
    ui_dir = os.path.join(plugin_dir, 'ui')
    if os.path.exists(os.path.join(ui_dir, 'package.json')):
        print(f"[*] Building UI...")
        try:
            # On Windows, we often need shell=True for npm
            use_shell = sys.platform == 'win32'
            
            if not os.path.exists(os.path.join(ui_dir, 'node_modules')):
                print("[*] Running npm install...")
                subprocess.run(['npm', 'install'], cwd=ui_dir, check=True, shell=use_shell)
            
            print("[*] Running npm run build...")
            subprocess.run(['npm', 'run', 'build'], cwd=ui_dir, check=True, shell=use_shell)
        except subprocess.CalledProcessError as e:
            print(f"[!] UI Build failed: {e}")
            return

    # 2. Create package zip
    dist_dir = os.path.join(root_dir, 'dist')
    os.makedirs(dist_dir, exist_ok=True)
    zip_name = os.path.join(dist_dir, f"{plugin_slug}.zip")
    
    print(f"[*] Packaging files into {zip_name}...")
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add manifest
        manifest_path = os.path.join(plugin_dir, 'manifest.yaml')
        if os.path.exists(manifest_path):
            zipf.write(manifest_path, 'manifest.yaml')
        else:
            print("[!] Warning: manifest.yaml not found!")
        
        # Add backend
        backend_dir = os.path.join(plugin_dir, 'backend')
        if os.path.exists(backend_dir):
            for root, dirs, files in os.walk(backend_dir):
                for file in files:
                    if '__pycache__' in root:
                        continue
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, plugin_dir)
                    zipf.write(abs_path, rel_path)
                
        # Add UI dist (mapped to 'ui/' in zip)
        ui_dist_dir = os.path.join(ui_dir, 'dist')
        if os.path.exists(ui_dist_dir):
            for root, dirs, files in os.walk(ui_dist_dir):
                for file in files:
                    abs_path = os.path.join(root, file)
                    # We want the files in the zip's 'ui/' directory
                    rel_path = os.path.join('ui', os.path.relpath(abs_path, ui_dist_dir))
                    zipf.write(abs_path, rel_path)
                    
    print(f"[+] Successfully built {plugin_slug}")

if __name__ == "__main__":
    # Get all subdirectories in current folder that have a manifest.yaml
    root_dir = os.path.dirname(os.path.abspath(__file__))
    plugins = [d for d in os.listdir(root_dir) if os.path.isdir(os.path.join(root_dir, d)) and os.path.exists(os.path.join(root_dir, d, 'manifest.yaml'))]
    
    if not plugins:
        print("No plugins found to build.")
    else:
        for p in plugins:
            build_plugin(p)
