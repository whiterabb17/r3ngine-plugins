import base64
import hashlib
import io
import json
import os
import subprocess
import sys
import zipfile
from datetime import datetime, timezone


def _load_signing_key():
    """Load Ed25519 private key from ~/.r3n/signing.key if present."""
    key_path = os.path.expanduser('~/.r3n/signing.key')
    if not os.path.exists(key_path):
        return None
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        with open(key_path, 'rb') as f:
            return load_pem_private_key(f.read(), password=None)
    except Exception as e:
        print(f"[!] Warning: could not load signing key: {e}")
        return None


def build_plugin(plugin_slug, sign=True):
    root_dir = os.path.dirname(os.path.abspath(__file__))
    plugin_dir = os.path.join(root_dir, plugin_slug)

    if not os.path.exists(plugin_dir):
        print(f"Error: Plugin directory '{plugin_slug}' not found.")
        return

    print(f"--- Building plugin: {plugin_slug} ---")

    # 1. Build UI if present
    ui_dir = os.path.join(plugin_dir, 'ui')
    if os.path.exists(os.path.join(ui_dir, 'package.json')):
        print("[*] Building UI...")
        try:
            use_shell = sys.platform == 'win32'
            if not os.path.exists(os.path.join(ui_dir, 'node_modules')):
                print("[*] Running npm install...")
                subprocess.run(['npm', 'install'], cwd=ui_dir, check=True, shell=use_shell)
            print("[*] Running npm run build...")
            subprocess.run(['npm', 'run', 'build'], cwd=ui_dir, check=True, shell=use_shell)
        except subprocess.CalledProcessError as e:
            print(f"[!] UI build failed: {e}")
            return

    # 2. Create inner plugin.zip in memory
    print("[*] Creating inner plugin.zip...")
    inner_buf = io.BytesIO()
    manifest_path = os.path.join(plugin_dir, 'manifest.yaml')
    with zipfile.ZipFile(inner_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(manifest_path):
            zf.write(manifest_path, 'manifest.yaml')
        else:
            print("[!] Warning: manifest.yaml not found!")

        backend_dir = os.path.join(plugin_dir, 'backend')
        if os.path.exists(backend_dir):
            for root, dirs, files in os.walk(backend_dir):
                for file in files:
                    if '__pycache__' in root:
                        continue
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, plugin_dir)
                    zf.write(abs_path, rel_path)

        ui_dist_dir = os.path.join(ui_dir, 'dist')
        if os.path.exists(ui_dist_dir):
            for root, dirs, files in os.walk(ui_dist_dir):
                for file in files:
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.join('ui', os.path.relpath(abs_path, ui_dist_dir))
                    zf.write(abs_path, rel_path)

        tools_path = os.path.join(plugin_dir, 'tools.yaml')
        if os.path.exists(tools_path):
            zf.write(tools_path, 'tools.yaml')

        for item in os.listdir(plugin_dir):
            if item.endswith('_engine.yaml'):
                zf.write(os.path.join(plugin_dir, item), item)

    inner_zip_bytes = inner_buf.getvalue()

    # 3. Compute SHA-256 over the inner zip
    content_hash = hashlib.sha256(inner_zip_bytes).hexdigest()
    print(f"[*] SHA-256: {content_hash[:16]}...")

    # 4. Read author + version from manifest.yaml
    author = ''
    version = '0.0.0'
    if os.path.exists(manifest_path):
        try:
            import yaml
            with open(manifest_path) as f:
                m = yaml.safe_load(f)
            author = m.get('author', '')
            version = m.get('version', '0.0.0')
        except Exception:
            pass

    # 5. Build r3n_manifest.json
    meta = {
        'format_version': '1',
        'plugin_slug': plugin_slug,
        'plugin_version': version,
        'author': author,
        'build_time': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'content_hash': content_hash,
    }

    # 6. Sign if a key is available
    if sign:
        private_key = _load_signing_key()
        if private_key is not None:
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
            sig = private_key.sign(content_hash.encode())
            pub_raw = private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
            meta['signature'] = base64.b64encode(sig).decode()
            meta['public_key'] = base64.b64encode(pub_raw).decode()
            meta['signed_by'] = author or plugin_slug
            print("[+] Signed with Ed25519 key.")
        else:
            print("[!] No signing key found at ~/.r3n/signing.key — building unsigned.")

    # 7. Bundle into outer .r3n zip (build into dist/, then place final in plugin dir)
    dist_dir = os.path.join(root_dir, 'dist')
    os.makedirs(dist_dir, exist_ok=True)
    dist_path = os.path.join(dist_dir, f"{plugin_slug}.r3n")

    print(f"[*] Writing {dist_path}...")
    with zipfile.ZipFile(dist_path, 'w', zipfile.ZIP_DEFLATED) as r3n_zip:
        r3n_zip.writestr('plugin.zip', inner_zip_bytes)
        r3n_zip.writestr('r3n_manifest.json', json.dumps(meta, indent=2))

    # Place the final .r3n back into the plugin's own directory for distribution
    import shutil
    final_path = os.path.join(plugin_dir, f"{plugin_slug}.r3n")
    shutil.copy2(dist_path, final_path)

    print(f"[+] Successfully built {plugin_slug}.r3n → {final_path}")


if __name__ == '__main__':
    root_dir = os.path.dirname(os.path.abspath(__file__))
    plugins = [
        d for d in os.listdir(root_dir)
        if os.path.isdir(os.path.join(root_dir, d))
        and os.path.exists(os.path.join(root_dir, d, 'manifest.yaml'))
    ]

    if not plugins:
        print("No plugins found to build.")
    else:
        for p in plugins:
            build_plugin(p)
